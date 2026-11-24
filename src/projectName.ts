import * as fs from "fs";
import * as path from "path";
import { XMLParser } from "fast-xml-parser";

export function getLaunchProjectName(workspacePath: string): string | undefined {
    const javaConfigFile = path.join(workspacePath, "javaConfig.json");
    if (!fs.existsSync(javaConfigFile)) {
        return undefined;
    }

    const javaConfig: unknown = JSON.parse(fs.readFileSync(javaConfigFile, "utf8"));
    if (!javaConfig || typeof javaConfig !== "object" || !("projects" in javaConfig)) {
        return undefined;
    }
    if (!Array.isArray(javaConfig.projects)) {
        throw new Error(`The projects setting in ${javaConfigFile} must be an array.`);
    }
    if (javaConfig.projects.length === 0) {
        return undefined;
    }
    const projectPath: unknown = javaConfig.projects[0];
    if (typeof projectPath !== "string" || !projectPath.trim()) {
        throw new Error(`The first project in ${javaConfigFile} must be a nonempty path.`);
    }

    const projectFile = path.join(path.resolve(workspacePath, projectPath), ".project");
    const parser = new XMLParser({ parseTagValue: false, htmlEntities: true });
    const project: unknown = parser.parse(fs.readFileSync(projectFile, "utf8"), true);
    if (project && typeof project === "object" && "projectDescription" in project) {
        const description = project.projectDescription;
        if (description && typeof description === "object" && "name" in description
            && typeof description.name === "string" && description.name.trim()) {
            return description.name.trim();
        }
    }
    throw new Error(`No projectDescription/name was found in ${projectFile}.`);
}
