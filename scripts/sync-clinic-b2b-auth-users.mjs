import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const ROOT = process.cwd();
const DEFAULT_TEMP_PASSWORD = "ClinicB2B@2026!";
const DRY_RUN = !process.argv.includes("--apply");

function parseEnvContents(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#][A-Za-z0-9_2]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    value = value
      .replace(/\\r\\n$/g, "")
      .replace(/\\n$/g, "")
      .replace(/\\r$/g, "")
      .replace(/\r\n$/g, "")
      .replace(/\n$/g, "")
      .replace(/\r$/g, "");

    values[match[1]] = value;
  }

  return values;
}

async function loadEnvFile(fileName) {
  const filePath = path.resolve(ROOT, fileName);
  const contents = await fs.readFile(filePath, "utf8");
  return parseEnvContents(contents);
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

async function findLatestExportDir() {
  const entries = await fs.readdir(path.resolve(ROOT, "local-exports"), { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("clinic-supabase-"))
    .map((entry) => entry.name)
    .sort();
  if (candidates.length === 0) {
    throw new Error("Nenhuma pasta de exportação clinic-supabase-* encontrada em local-exports.");
  }
  return path.resolve(ROOT, "local-exports", candidates[candidates.length - 1]);
}

async function loadTargetUserIds(exportDir) {
  const files = ["admin_users.json", "customer_profiles.json", "user_roles.json"];
  const ids = new Set();
  for (const fileName of files) {
    const filePath = path.join(exportDir, fileName);
    const file = JSON.parse(await fs.readFile(filePath, "utf8"));
    for (const row of file.rows ?? []) {
      if (row.user_id) ids.add(row.user_id);
    }
  }
  return ids;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function ensureJsonString(value) {
  return JSON.stringify(value ?? {});
}

async function listAllAuthUsers(client) {
  const perPage = 1000;
  let page = 1;
  const users = [];

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const pageUsers = data?.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
}

function pickDisplayName(user) {
  return (
    user.user_metadata?.name?.trim() ||
    user.user_metadata?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    ""
  );
}

function buildUserMetadata(user, email) {
  const meta = { ...(user.user_metadata ?? {}) };
  if (!meta.email) meta.email = email;
  if (!meta.sub) meta.sub = user.id;
  if (typeof meta.email_verified !== "boolean") meta.email_verified = true;
  if (typeof meta.phone_verified !== "boolean") meta.phone_verified = Boolean(user.phone);
  if (!meta.name) meta.name = pickDisplayName(user);
  return meta;
}

function buildAppMetadata(user) {
  const meta = { ...(user.app_metadata ?? {}) };
  if (!meta.provider) meta.provider = "email";
  if (!Array.isArray(meta.providers) || !meta.providers.includes("email")) {
    meta.providers = ["email"];
  }
  return meta;
}

function buildAuthInsertParams(user, instanceId, tempPassword) {
  const email = normalizeEmail(user.email ?? user.user_metadata?.email);
  const createdAt = toIsoOrNull(user.created_at) ?? new Date().toISOString();
  const confirmedAt = toIsoOrNull(user.confirmed_at ?? user.email_confirmed_at) ?? createdAt;
  const updatedAt = toIsoOrNull(user.updated_at) ?? new Date().toISOString();

  const rawUserMeta = buildUserMetadata(user, email);
  const rawAppMeta = buildAppMetadata(user);

  return [
    instanceId,
    user.id,
    user.aud ?? "authenticated",
    user.role ?? "authenticated",
    email,
    tempPassword,
    confirmedAt,
    toIsoOrNull(user.invited_at),
    user.confirmation_token ?? null,
    toIsoOrNull(user.confirmation_sent_at),
    user.recovery_token ?? null,
    toIsoOrNull(user.recovery_sent_at),
    user.email_change_token_new ?? null,
    user.email_change ?? null,
    toIsoOrNull(user.email_change_sent_at),
    toIsoOrNull(user.last_sign_in_at),
    ensureJsonString(rawAppMeta),
    ensureJsonString(rawUserMeta),
    Boolean(user.is_super_admin ?? false),
    createdAt,
    updatedAt,
    user.phone ?? null,
    toIsoOrNull(user.phone_confirmed_at),
    user.phone_change ?? "",
    user.phone_change_token ?? "",
    toIsoOrNull(user.phone_change_sent_at),
    user.email_change_token_current ?? "",
    Number.isFinite(user.email_change_confirm_status) ? user.email_change_confirm_status : 0,
    toIsoOrNull(user.banned_until),
    user.reauthentication_token ?? "",
    toIsoOrNull(user.reauthentication_sent_at),
    Boolean(user.is_sso_user ?? false),
    toIsoOrNull(user.deleted_at),
    Boolean(user.is_anonymous ?? false),
  ];
}

async function main() {
  const newEnv = await loadEnvFile(".env");
  const oldEnvCandidates = [".env.vercel", ".env.vercel.production"];
  let oldEnv = null;
  for (const candidate of oldEnvCandidates) {
    try {
      oldEnv = await loadEnvFile(candidate);
      if (oldEnv.SUPABASE_SERVICE_ROLE_KEY && oldEnv.VITE_SUPABASE_PROJECT_ID) break;
    } catch {
      // ignore missing fallback files
    }
  }

  if (!oldEnv?.SUPABASE_SERVICE_ROLE_KEY || !oldEnv?.VITE_SUPABASE_PROJECT_ID) {
    throw new Error("Não consegui ler o projeto antigo a partir de .env.vercel/.env.vercel.production.");
  }

  if (!newEnv["DATABASE_URL"]) {
    throw new Error("DATABASE_URL não encontrado em .env.");
  }

  const tempPassword = process.argv.find((arg) => arg.startsWith("--password="))?.slice("--password=".length) ?? DEFAULT_TEMP_PASSWORD;
  const oldUrl = `https://${oldEnv.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
  const oldClient = createClient(oldUrl, oldEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pool = new Pool({
    connectionString: newEnv["DATABASE_URL"],
    ssl: { rejectUnauthorized: false },
  });

  const exportDir = await findLatestExportDir();
  const targetIds = await loadTargetUserIds(exportDir);
  const targetIdList = [...targetIds];

  const [oldUsers, currentUsers, instanceResult] = await Promise.all([
    listAllAuthUsers(oldClient),
    pool.query(`select id, email from auth.users;`),
    pool.query(`select instance_id from auth.users where instance_id is not null order by created_at asc limit 1;`),
  ]);

  const targetUsers = oldUsers.filter((user) => targetIds.has(user.id));

  const currentById = new Map();
  const currentByEmail = new Map();
  for (const row of currentUsers.rows) {
    currentById.set(row.id, row);
    currentByEmail.set(normalizeEmail(row.email), row);
  }

  const instanceId = instanceResult.rows[0]?.instance_id ?? "00000000-0000-0000-0000-000000000000";
  const insertSql = `
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
      confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
      email_change_token_new, email_change, email_change_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
      phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
      email_change_token_current, email_change_confirm_status,
      banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user,
      deleted_at, is_anonymous
    ) values (
      $1::uuid, $2::uuid, $3, $4, $5, crypt($6, gen_salt('bf')), $7::timestamptz, $8::timestamptz,
      $9, $10::timestamptz, $11, $12::timestamptz,
      $13, $14, $15::timestamptz, $16::timestamptz,
      $17::jsonb, $18::jsonb, $19::boolean, $20::timestamptz, $21::timestamptz,
      $22, $23::timestamptz, $24, $25, $26::timestamptz,
      $27, $28::smallint,
      $29::timestamptz, $30, $31::timestamptz, $32::boolean,
      $33::timestamptz, $34::boolean
    )
    on conflict (id) do update set
      instance_id = excluded.instance_id,
      aud = excluded.aud,
      role = excluded.role,
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      invited_at = excluded.invited_at,
      confirmation_token = excluded.confirmation_token,
      confirmation_sent_at = excluded.confirmation_sent_at,
      recovery_token = excluded.recovery_token,
      recovery_sent_at = excluded.recovery_sent_at,
      email_change_token_new = excluded.email_change_token_new,
      email_change = excluded.email_change,
      email_change_sent_at = excluded.email_change_sent_at,
      last_sign_in_at = excluded.last_sign_in_at,
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      is_super_admin = excluded.is_super_admin,
      updated_at = excluded.updated_at,
      phone = excluded.phone,
      phone_confirmed_at = excluded.phone_confirmed_at,
      phone_change = excluded.phone_change,
      phone_change_token = excluded.phone_change_token,
      phone_change_sent_at = excluded.phone_change_sent_at,
      email_change_token_current = excluded.email_change_token_current,
      email_change_confirm_status = excluded.email_change_confirm_status,
      banned_until = excluded.banned_until,
      reauthentication_token = excluded.reauthentication_token,
      reauthentication_sent_at = excluded.reauthentication_sent_at,
      is_sso_user = excluded.is_sso_user,
      deleted_at = excluded.deleted_at,
      is_anonymous = excluded.is_anonymous
    returning id, email;
  `;

  const identitySql = `
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at,
      created_at, updated_at, email
    ) values (
      $1, $2::uuid, $3::jsonb, $4, $5::timestamptz,
      $6::timestamptz, $7::timestamptz, $8
    )
    on conflict (provider_id, provider) do update set
      user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      last_sign_in_at = excluded.last_sign_in_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      email = excluded.email
    returning id, email;
  `;

  const renameConflictUserSql = `
    update auth.users
       set email = $1,
           raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{email}', to_jsonb($1::text), true),
           updated_at = now()
     where id = $2::uuid;
  `;
  const renameConflictIdentitySql = `
    update auth.identities
       set email = $1,
           identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb($1::text), true),
           updated_at = now()
     where user_id = $2::uuid;
  `;

  const plan = [];
  for (const oldUser of targetUsers) {
    const email = normalizeEmail(oldUser.email ?? oldUser.user_metadata?.email);
    if (!email) {
      plan.push({ type: "skip", id: oldUser.id, reason: "sem e-mail" });
      continue;
    }

    const currentByTargetId = currentById.get(oldUser.id);
    const currentByTargetEmail = currentByEmail.get(email);
    const emailConflict = currentByTargetEmail && currentByTargetEmail.id !== oldUser.id;
    if (currentByTargetId || currentByTargetEmail) {
      plan.push({
        type: currentByTargetId ? "update" : "insert",
        id: oldUser.id,
        email,
        conflictId: emailConflict ? currentByTargetEmail.id : null,
      });
    } else {
      plan.push({ type: "insert", id: oldUser.id, email });
    }
  }

  const summary = {
    dryRun: DRY_RUN,
    oldAuthUsers: oldUsers.length,
    targetExportUsers: targetUsers.length,
    currentAuthUsers: currentUsers.rows.length,
    planned: plan.length,
    conflicts: plan.filter((item) => item.conflictId).length,
    tempPassword,
    exportDir,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (DRY_RUN) {
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const item of plan) {
      const user = targetUsers.find((candidate) => candidate.id === item.id);
      if (!user) continue;

      const email = normalizeEmail(user.email ?? user.user_metadata?.email);
      const currentByTargetEmail = currentByEmail.get(email);
      if (currentByTargetEmail && currentByTargetEmail.id !== user.id) {
        const placeholderEmail = `migrated-${currentByTargetEmail.id.replace(/-/g, "").slice(0, 12)}@invalid.local`;
        await client.query(renameConflictUserSql, [placeholderEmail, currentByTargetEmail.id]);
        await client.query(renameConflictIdentitySql, [placeholderEmail, currentByTargetEmail.id]);
        currentById.delete(currentByTargetEmail.id);
        currentByEmail.delete(email);
      }

      const userParams = buildAuthInsertParams(user, instanceId, tempPassword);
      await client.query(insertSql, userParams);

      const identityPayload = {
        sub: user.id,
        email,
        email_verified: user.user_metadata?.email_verified ?? true,
        phone_verified: user.user_metadata?.phone_verified ?? Boolean(user.phone),
      };
      const now = toIsoOrNull(user.updated_at) ?? new Date().toISOString();
      const identityParams = [
        user.id,
        user.id,
        ensureJsonString(identityPayload),
        "email",
        toIsoOrNull(user.last_sign_in_at),
        toIsoOrNull(user.created_at) ?? now,
        now,
        email,
      ];
      await client.query(identitySql, identityParams);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  const verifyPool = new Pool({
    connectionString: newEnv["DATABASE_URL"],
    ssl: { rejectUnauthorized: false },
  });
  try {
    const verify = await verifyPool.query(
      `select count(*)::int as count from auth.users where id = any($1::uuid[])`,
      [targetIdList],
    );
    console.log(JSON.stringify({ verifiedCount: verify.rows[0]?.count ?? 0 }, null, 2));
  } finally {
    await verifyPool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
