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
  static async new(): Promise<CacheConfig> {
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
   * Reads and returns the cache config from the action `state`.
   *
   * @throws {Error} if the state is not present.
   * @returns {CacheConfig} the configuration.
   * @see {@link CacheConfig#saveState}
   * @see {@link CacheConfig#new}
   */
  static fromState(): CacheConfig {
    const source = core.getState(STATE_CONFIG);
    if (!source) {
      throw new Error("Cache configuration not found in state");
    }

    const self = new CacheConfig();
    Object.assign(self, JSON.parse(source));
    self.workspaces = self.workspaces.map((w: any) => new Workspace(w.root, w.target));

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
