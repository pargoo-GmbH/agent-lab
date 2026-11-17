import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillName = "strapi-editor";
const packageName = "pargoo-strapi-editor";
const supportDirectories = ["agents", "references", "scripts", "assets"];
const excludedDirectories = new Set(["node_modules", "dist", "__pycache__"]);
const archiveDate = new Date("2000-01-01T00:00:00.000Z");
const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TZ: "UTC" },
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.stderr.trim()}`,
    );
  }
}

async function copyEntry(source: string, destination: string): Promise<void> {
  const entry = await lstat(source);

  if (entry.isSymbolicLink()) {
    throw new Error(`Symlinks are not allowed in the package: ${source}`);
  }

  if (entry.isDirectory()) {
    await mkdir(destination, { recursive: true });

    for (const name of (await readdir(source)).sort()) {
      if (name.startsWith(".") || excludedDirectories.has(name)) {
        continue;
      }

      await copyEntry(join(source, name), join(destination, name));
    }

    return;
  }

  if (!entry.isFile()) {
    throw new Error(`Only regular files can be packaged: ${source}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  await chmod(destination, entry.mode & 0o111 ? 0o755 : 0o644);
  await utimes(destination, archiveDate, archiveDate);
}

async function listFiles(root: string, relative = ""): Promise<string[]> {
  const files: string[] = [];

  for (const entry of await readdir(join(root, relative), {
    withFileTypes: true,
  })) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, path)));
    } else {
      files.push(path);
    }
  }

  return files.sort();
}

export async function buildPackage(root = repositoryRoot): Promise<string> {
  const temporary = await mkdtemp(join(tmpdir(), `${packageName}-`));
  const staging = join(temporary, "package");

  try {
    const skill = join(root, "skills", skillName);
    const directory = await lstat(skill);

    if (!directory.isDirectory() || directory.isSymbolicLink()) {
      throw new Error("The skill must be a real directory, not a symlink.");
    }

    await copyEntry(
      join(root, "scripts", "strapi-editor.plugin.json"),
      join(staging, "plugin.json"),
    );
    await copyEntry(join(skill, "README.md"), join(staging, "README.md"));
    await copyEntry(
      join(skill, "SKILL.md"),
      join(staging, "skills", skillName, "SKILL.md"),
    );

    for (const directory of supportDirectories) {
      const source = join(skill, directory);

      try {
        await lstat(source);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }

        throw error;
      }

      await copyEntry(source, join(staging, "skills", skillName, directory));
    }

    const manifest = JSON.parse(
      await readFile(join(staging, "plugin.json"), "utf8"),
    );

    if (
      manifest.$schema !==
        "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json" ||
      manifest.name !== packageName ||
      typeof manifest.version !== "string" ||
      !semanticVersion.test(manifest.version)
    ) {
      throw new Error(
        "The plugin manifest needs its expected identity and a semantic version.",
      );
    }

    if (
      ["apps", "skills", "mcpServers", "interface", "hooks"].some(
        (key) => key in manifest,
      ) ||
      manifest.extensions?.["com.openai"]?.apps != null ||
      manifest.extensions?.["com.openai"]?.hooks != null
    ) {
      throw new Error(
        "The customer package must remain a portable skills-only plugin.",
      );
    }

    const subtitle =
      manifest.extensions?.["com.openai"]?.interface?.shortDescription;

    if (
      typeof subtitle !== "string" ||
      !subtitle.trim() ||
      subtitle.length > 30
    ) {
      throw new Error("The plugin subtitle must contain 1–30 characters.");
    }

    const instructions = await readFile(
      join(staging, "skills", skillName, "SKILL.md"),
      "utf8",
    );
    const frontmatter = instructions.match(
      /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
    )?.[1];

    if (
      !frontmatter ||
      !/^name: strapi-editor\s*$/m.test(frontmatter) ||
      !/^description: \S.+$/m.test(frontmatter)
    ) {
      throw new Error(
        "SKILL.md needs matching name and description frontmatter.",
      );
    }

    const archiveName = `${packageName}-${manifest.version}.zip`;
    const temporaryArchive = join(temporary, archiveName);
    run(
      "zip",
      ["-X", "-q", temporaryArchive, ...(await listFiles(staging))],
      staging,
    );
    run("unzip", ["-tq", temporaryArchive], temporary);
    const output = join(root, "dist", archiveName);
    await mkdir(dirname(output), { recursive: true });
    await copyFile(temporaryArchive, output);

    return output;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const archive = await buildPackage();
    const digest = createHash("sha256")
      .update(await readFile(archive))
      .digest("hex");
    process.stdout.write(`${archive}\nSHA-256: ${digest}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
