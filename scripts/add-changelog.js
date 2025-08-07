const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const today = new Date().toISOString().split("T")[0];

rl.question("Versión (ej: v0.1.1): ", (version) => {
  rl.question("Resumen de cambios: ", (summary) => {
    const entry = `\n## ${version} – ${today}\n\n- ${summary}\n`;

    const changelogPath = "CHANGELOG.md";
    const oldContent = fs.existsSync(changelogPath)
      ? fs.readFileSync(changelogPath, "utf8")
      : "# Changelog\n";

    const newContent = oldContent.replace("# Changelog", `# Changelog${entry}`);

    fs.writeFileSync(changelogPath, newContent, "utf8");
    console.log(`✅ Añadido changelog para ${version}`);
    rl.close();
  });
});
