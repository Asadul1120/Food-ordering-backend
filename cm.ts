import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const createModule = async (): Promise<void> => {
  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    const input = await rl.question("Enter Module Name: ");

    const moduleName = input
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    if (!moduleName) {
      console.log("Module name is required!");
      return;
    }

    const modulePath = path.join(process.cwd(), "src", "modules", moduleName);

    const files = [
      `${moduleName}.controller.ts`,
      `${moduleName}.interface.ts`,
      `${moduleName}.route.ts`,
      `${moduleName}.service.ts`,
      `${moduleName}.validation.ts`,
    ];

    fs.mkdirSync(modulePath, { recursive: true });

    files.forEach((file) => {
      const filePath = path.join(modulePath, file);

      if (fs.existsSync(filePath)) {
        console.log(`Already exists: ${file}`);
        return;
      }

      fs.writeFileSync(filePath, "");

      console.log(`Created: ${file}`);
    });

    console.log(`\nModule created successfully: ${moduleName}`);
  } finally {
    rl.close();
  }
};

createModule();
