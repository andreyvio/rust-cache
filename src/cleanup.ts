import * as core from "@actions/core";
import * as io from "@actions/io";
import fs from "fs";
import path from "path";

import { exists } from "./utils";
import { Packages } from "./workspace";

export async function cleanTargetDir(targetDir: string, packages: Packages, checkTimestamp = false) {
  core.debug(`cleaning target directory "${targetDir}"`);

  // remove all *files* from the profile directory
  let dir = await fs.promises.opendir(targetDir);
  for await (const dirent of dir) {
    if (dirent.isDirectory()) {
      let dirName = path.join(dir.path, dirent.name);
      // is it a profile dir, or a nested target dir?
      let isNestedTarget =
        (await exists(path.join(dirName, "CACHEDIR.TAG"))) || (await exists(path.join(dirName, ".rustc_info.json")));

      try {
        if (isNestedTarget) {
          await cleanTargetDir(dirName, packages, checkTimestamp);
        } else {
          await cleanProfileTarget(dirName, packages, checkTimestamp);
        }
      } catch {}
    } else if (dirent.name !== "CACHEDIR.TAG") {
      await rm(dir.path, dirent);
    }
  }
}

async function cleanProfileTarget(profileDir: string, packages: Packages, checkTimestamp = false) {
  core.debug(`cleaning profile directory "${profileDir}"`);

  // Quite a few testing utility crates store compilation artifacts as nested
  // workspaces under `target/tests`. Notably, `target/tests/target` and
  // `target/tests/trybuild`.
  if (path.basename(profileDir) === "tests") {
    try {
      // https://github.com/vertexclique/kaos/blob/9876f6c890339741cc5be4b7cb9df72baa5a6d79/src/cargo.rs#L25
      // https://github.com/eupn/macrotest/blob/c4151a5f9f545942f4971980b5d264ebcd0b1d11/src/cargo.rs#L27
      cleanTargetDir(path.join(profileDir, "target"), packages, checkTimestamp);
    } catch {}
    try {
      // https://github.com/dtolnay/trybuild/blob/eec8ca6cb9b8f53d0caf1aa499d99df52cae8b40/src/cargo.rs#L50
      cleanTargetDir(path.join(profileDir, "trybuild"), packages, checkTimestamp);
    } catch {}

    // Delete everything else.
    await rmExcept(profileDir, new Set(["target", "trybuild"]), checkTimestamp);

    return;
  }

  let keepProfile = new Set(["build", ".fingerprint", "deps"]);
  await rmExcept(profileDir, keepProfile);

  const keepPkg = new Set(packages.map((p) => p.name));
  await rmExcept(path.join(profileDir, "build"), keepPkg, checkTimestamp);
  await rmExcept(path.join(profileDir, ".fingerprint"), keepPkg, checkTimestamp);

  const keepDeps = new Set(
    packages.flatMap((p) => {
      const names = [];
      for (const n of [p.name, ...p.targets]) {
        const name = n.replace(/-/g, "_");
        names.push(name, `lib${name}`);
      }
      return names;
    }),
  );
  await rmExcept(path.join(profileDir, "deps"), keepDeps, checkTimestamp);
}

const ONE_WEEK = 7 * 24 * 3600 * 1000;

/**
 * Removes all files or directories in `dirName` matching some criteria.
 *
 * When the `checkTimestamp` flag is set, this will also remove anything older
 * than one week.
 *
 * Otherwise, it will remove everything that does not match any string in the
 * `keepPrefix` set.
 * The matching strips and trailing `-$hash` suffix.
 */
async function rmExcept(dirName: string, keepPrefix: Set<string>, checkTimestamp = false) {
  const dir = await fs.promises.opendir(dirName);
  for await (const dirent of dir) {
    if (checkTimestamp) {
      const fileName = path.join(dir.path, dirent.name);
      const { mtime } = await fs.promises.stat(fileName);
      const isOutdated = Date.now() - mtime.getTime() > ONE_WEEK;

      if (isOutdated) {
        await rm(dir.path, dirent);
      }
      return;
    }

    let name = dirent.name;

    // strip the trailing hash
    const idx = name.lastIndexOf("-");
    if (idx !== -1) {
      name = name.slice(0, idx);
    }

    if (!keepPrefix.has(name)) {
      await rm(dir.path, dirent);
    }
  }
}

async function rm(parent: string, dirent: fs.Dirent) {
  try {
    const fileName = path.join(parent, dirent.name);
    core.debug(`deleting "${fileName}"`);
    if (dirent.isFile()) {
      await fs.promises.unlink(fileName);
    } else if (dirent.isDirectory()) {
      await io.rmRF(fileName);
    }
  } catch {}
}
