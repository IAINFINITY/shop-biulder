import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const ROOT = process.cwd();
const DEFAULT_TEMP_PASSWORD = "ClinicB2B@2026!";
const PUBLIC_USER_REFERENCE_COLUMNS = [
  { table: 'clinic+b2b_admin_users', column: 'user_id' },
  { table: 'clinic+b2b_catalog_notification_reads', column: 'user_id' },
  { table: 'clinic+b2b_customer_addresses', column: 'user_id' },
  { table: 'clinic+b2b_customer_profiles', column: 'representante_id' },
  { table: 'clinic+b2b_customer_profiles', column: 'user_id' },
  { table: 'clinic+b2b_product_reviews', column: 'user_id' },
  { table: 'clinic+b2b_user_roles', column: 'user_id' },
];

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

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function buildMappingValuesSql(mappings) {
  return mappings
    .map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::uuid)`)
    .join(", ");
}

async function remapPublicColumn(pool, table, column, mappings) {
  const effectiveMappings = mappings.filter((mapping) => mapping.oldId !== mapping.newId);
  if (effectiveMappings.length === 0) return 0;

  const params = [];
  for (const mapping of effectiveMappings) {
    params.push(mapping.oldId, mapping.newId);
  }

  const sql = `
    with mapping(old_id, new_id) as (
      values ${buildMappingValuesSql(effectiveMappings)}
    )
    update public.${quoteIdent(table)} as target
       set ${quoteIdent(column)} = mapping.new_id
      from mapping
     where target.${quoteIdent(column)} = mapping.old_id;
  `;

  const result = await pool.query(sql, params);
  return result.rowCount ?? 0;
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
  const dryRun = !process.argv.includes("--apply");
  const oldUrl = `https://${oldEnv.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
  const newUrl = newEnv.VITE_SUPABASE_URL;
  const oldClient = createClient(oldUrl, oldEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const newClient = createClient(newUrl, newEnv.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const pool = new Pool({
    connectionString: newEnv["DATABASE_URL"],
    ssl: { rejectUnauthorized: false },
  });

  const exportDir = await findLatestExportDir();
  const targetIds = await loadTargetUserIds(exportDir);
  const targetIdList = [...targetIds];

  const [oldUsers, currentUsers] = await Promise.all([
    listAllAuthUsers(oldClient),
    listAllAuthUsers(newClient),
  ]);

  const targetUsers = oldUsers.filter((user) => targetIds.has(user.id));
  const currentById = new Map(currentUsers.map((user) => [user.id, user]));
  const currentByEmail = new Map(currentUsers.map((user) => [normalizeEmail(user.email), user]));

  const summary = {
    dryRun,
    oldAuthUsers: oldUsers.length,
    targetExportUsers: targetUsers.length,
    currentAuthUsers: currentUsers.length,
    tempPassword,
    exportDir,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    await pool.end();
    return;
  }

  const mapping = [];

  try {
    for (const targetUser of targetUsers) {
      const email = normalizeEmail(targetUser.email ?? targetUser.user_metadata?.email);
      if (!email) {
        throw new Error(`Usuário ${targetUser.id} sem e-mail não pode ser recriado no Auth.`);
      }

      const currentSameId = currentById.get(targetUser.id);
      const currentSameEmail = currentByEmail.get(email);

      if (currentSameId && normalizeEmail(currentSameId.email) === email) {
        await newClient.auth.admin.updateUserById(targetUser.id, {
          email,
          email_confirm: true,
          password: tempPassword,
          phone: targetUser.phone ?? currentSameId.phone ?? undefined,
          phone_confirm: Boolean(targetUser.phone ?? currentSameId.phone),
          user_metadata: buildUserMetadata(targetUser, email),
          app_metadata: buildAppMetadata(targetUser),
        });
        mapping.push({ oldId: targetUser.id, newId: targetUser.id });
        continue;
      }

      if (currentSameEmail && currentSameEmail.id !== targetUser.id) {
        const placeholderEmail = `migrated-${currentSameEmail.id.replace(/-/g, "").slice(0, 12)}@invalid.local`;
        await newClient.auth.admin.updateUserById(currentSameEmail.id, {
          email: placeholderEmail,
          email_confirm: false,
          user_metadata: {
            ...(currentSameEmail.user_metadata ?? {}),
            email: placeholderEmail,
            sub: currentSameEmail.id,
            email_verified: false,
          },
        });
      }

      const created = await newClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        phone: targetUser.phone ?? undefined,
        phone_confirm: Boolean(targetUser.phone),
        user_metadata: buildUserMetadata(targetUser, email),
        app_metadata: buildAppMetadata(targetUser),
      });

      if (created.error) {
        throw new Error(`Falha ao criar ${email}: ${created.error.message}`);
      }

      const newId = created.data?.user?.id;
      if (!newId) {
        throw new Error(`Auth não retornou id para ${email}.`);
      }

      mapping.push({ oldId: targetUser.id, newId });
      currentById.set(newId, created.data.user);
      currentByEmail.set(email, created.data.user);
    }

    const publicUpdates = [
      ["clinic+b2b_admin_users", "user_id"],
      ["clinic+b2b_catalog_notification_reads", "user_id"],
      ["clinic+b2b_customer_addresses", "user_id"],
      ["clinic+b2b_customer_profiles", "representante_id"],
      ["clinic+b2b_customer_profiles", "user_id"],
      ["clinic+b2b_product_reviews", "user_id"],
      ["clinic+b2b_user_roles", "user_id"],
    ];

    const totalRemapped = {};
    for (const [table, column] of publicUpdates) {
      const affected = await remapPublicColumn(pool, table, column, mapping);
      totalRemapped[`${table}.${column}`] = affected;
    }

    const verify = await pool.query(
      `select count(*)::int as count from auth.users where email = any($1::text[])`,
      [targetUsers.map((user) => normalizeEmail(user.email ?? user.user_metadata?.email))],
    );

    console.log(JSON.stringify({
      recreatedUsers: mapping.length,
      verifyCount: verify.rows[0]?.count ?? 0,
      remappedColumns: totalRemapped,
    }, null, 2));
  } finally {
    await pool.end();
  }

  const mappingReport = {
    generatedAt: new Date().toISOString(),
    exportDir,
    tempPassword,
    mappings: mapping,
  };
  await fs.writeFile(
    path.resolve(ROOT, "local-exports", "clinic-b2b-auth-sync-report.json"),
    `${JSON.stringify(mappingReport, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
