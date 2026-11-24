import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getLaunchProjectName } from "../projectName";

describe("Launch project name", () => {
    let workspace: string;

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-pde-project-name-"));
    });

    afterEach(() => {
        fs.rmSync(workspace, { recursive: true, force: true });
    });

    function configureProject(xml: string, absolute = false) {
        const project = path.join(workspace, "different-folder-name");
        fs.mkdirSync(project);
        fs.writeFileSync(path.join(project, ".project"), xml);
        fs.writeFileSync(path.join(workspace, "javaConfig.json"), JSON.stringify({
            projects: [absolute ? project : "./different-folder-name", "./unused-project"],
        }));
    }

    it("reads the first project's declared name, not its folder or builder name", () => {
        configureProject(`<?xml version="1.0" encoding="UTF-8"?>
            <projectDescription>
                <!-- <name>wrong-comment-name</name> -->
                <name>actual.project.name</name>
                <buildSpec><buildCommand><name>builder.name</name></buildCommand></buildSpec>
            </projectDescription>`);
        assert.strictEqual(getLaunchProjectName(workspace), "actual.project.name");
    });

    it("supports absolute project paths and decodes XML entities", () => {
        configureProject("<projectDescription><name>  A &amp; B &#x31;  </name></projectDescription>", true);
        assert.strictEqual(getLaunchProjectName(workspace), "A & B 1");
    });

    it("preserves numeric names as strings and supports CDATA", () => {
        configureProject("<projectDescription><name>00123</name></projectDescription>");
        assert.strictEqual(getLaunchProjectName(workspace), "00123");
        fs.writeFileSync(path.join(workspace, "different-folder-name", ".project"),
            "<projectDescription><name><![CDATA[A & B]]></name></projectDescription>");
        assert.strictEqual(getLaunchProjectName(workspace), "A & B");
    });

    it("omits the name when no projects are configured", () => {
        assert.strictEqual(getLaunchProjectName(workspace), undefined);
        for (const config of [{}, { projects: [] }]) {
            fs.writeFileSync(path.join(workspace, "javaConfig.json"), JSON.stringify(config));
            assert.strictEqual(getLaunchProjectName(workspace), undefined);
        }
    });

    it("rejects unreadable project files and malformed configuration", () => {
        fs.writeFileSync(path.join(workspace, "javaConfig.json"), JSON.stringify({ projects: ["./missing"] }));
        assert.throws(() => getLaunchProjectName(workspace), /ENOENT/);
        for (const config of ["{", '{"projects":"wrong"}', '{"projects":[""]}']) {
            fs.writeFileSync(path.join(workspace, "javaConfig.json"), config);
            assert.throws(() => getLaunchProjectName(workspace));
        }
    });

    it("rejects malformed XML and missing, empty, or duplicate project names", () => {
        configureProject("<projectDescription><name>broken</projectDescription>");
        const projectFile = path.join(workspace, "different-folder-name", ".project");
        for (const xml of [
            "<projectDescription><name>broken</projectDescription>",
            "<projectDescription><buildSpec><name>builder</name></buildSpec></projectDescription>",
            "<projectDescription><name> </name></projectDescription>",
            "<projectDescription><name>one</name><name>two</name></projectDescription>",
        ]) {
            fs.writeFileSync(projectFile, xml);
            assert.throws(() => getLaunchProjectName(workspace));
        }
    });
});
