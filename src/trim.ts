import {reportError} from "./utils";
import {CacheConfig} from "./config";
import * as core from "@actions/core";
import {cleanTargetDir} from "./cleanup";

async function run() {
    try {
        const config = CacheConfig.new();

        const allPackages = [];
        for (const workspace of config.workspaces) {
            const packages = await workspace.getPackagesOutsideWorkspaceRoot();
            allPackages.push(...packages);
            try {
                core.info(`... Cleaning ${workspace.target} ...`);
                await cleanTargetDir(workspace.target, packages);
            } catch (e) {
                core.debug(`${(e as any).stack}`);
            }
        }
    } catch (e) {
        reportError(e);
    }
    process.exit();
}

run();
