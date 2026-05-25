import fs from "fs";

const p = "src/pages/Admin.tsx";
let s = fs.readFileSync(p, "utf8");

const markerStart = '        <motion.div className="space-y-2">';
const markerStart2 = '        <div className="space-y-2">\n          <Label className="text-sm font-medium">Imagens do produto</Label>';

let i = s.indexOf(markerStart2);
if (i < 0) {
  console.error("start not found");
  process.exit(1);
}

const markerEnd = '        <div className="flex items-center gap-2">\n          <Switch checked={editing.active}';
const j = s.indexOf(markerEnd, i);
if (j < 0) {
  console.error("end not found");
  process.exit(1);
}

const repl = `        <ProductImageUploader
          imageUrls={editing.image_urls}
          onChange={(image_urls) => setEditing({ ...editing, image_urls })}
          uploading={uploading}
          onFilesSelected={handleImageFiles}
        />

`;

s = s.slice(0, i) + repl + s.slice(j);
fs.writeFileSync(p, s);
console.log("patched", { i, j });
