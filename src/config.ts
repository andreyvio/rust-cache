import * as core from "@actions/core";
import os from "os";
import path from "path";

import { Workspace } from "./workspace";

const HOME = os.homedir();
export const CARGO_HOME = process.env.CARGO_HOME || path.join(HOME, ".cargo");

const STATE_CONFIG = "RUST_CACHE_CONFIG";

export class CacheConfig {
  /** The workspace configurations */
  public workspaces: Array<Workspace> = [];

  private constructor() {}

  /**
   * Constructs a [`CacheConfig`] with all the paths and keys.
   *
   * This will read the action `input`s, and read and persist `state` as necessary.
   */
  static new(): CacheConfig {
    const self = new CacheConfig();

    const workspaces: Array<Workspace> = [];
    const workspacesInput = core.getInput("workspaces") || ".";
    for (const workspace of workspacesInput.trim().split("\n")) {
      let [root, target = "target"] = workspace.split("->").map((s) => s.trim());
      root = path.resolve(root);
      target = path.join(root, target);
      workspaces.push(new Workspace(root, target));
    }
    self.workspaces = workspaces;

    return self;
  }

  /**
   * Saves the configuration to the state store.
   * This is used to restore the configuration in the post action.
   */
  saveState() {
    core.saveState(STATE_CONFIG, this);
  }
}
