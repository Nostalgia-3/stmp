import { existsSync } from "node:fs";

// TODO: everything
export class SettingsManager {
    c: Record<string, unknown>;
    protected settingsFile: string;

    protected isType(tag: string, t: "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function") {
        if(this.c[tag] && typeof(this.c[tag]) != t) {
            return false;
        }

        return true;
    }

    constructor(settings = 'settings.json', default_: Record<string, unknown>) {
        if(!existsSync('resources')) {
            Deno.mkdirSync('resources');
        }

        this.settingsFile = settings;

        if(!existsSync(`resources/${settings}`)) {
            Deno.writeTextFileSync(`resources/${settings}`, JSON.stringify(default_));
        }

        this.c = JSON.parse(Deno.readTextFileSync(`resources/${settings}`));
    }

    save() {
        Deno.writeTextFileSync(`resources/${this.settingsFile}`, JSON.stringify(this.c));
    }

    load() {
        if(!existsSync('resources')) {
            Deno.mkdirSync('resources');
        }

        if(!existsSync(`resources/${this.settingsFile}`)) {
            return;
        }

        this.c = JSON.parse(Deno.readTextFileSync(`resources/${this.settingsFile}`));
    }

    setString(s: string, v: string, forceType = true) {
        if(forceType && !this.isType(s, 'string')) return;
        this.c[s] = v;
    }

    setBool(s: string, v: boolean, forceType = true) {
        if(forceType && !this.isType(s, 'boolean')) return;
        this.c[s] = v;
    }

    getString(s: string): string | undefined {
        if(!this.isType(s, 'string')) return;
        return this.c[s] as string;
    }

    getBool(s: string): boolean | undefined {
        if(!this.isType(s, 'boolean')) return;
        return this.c[s] as boolean;
    }
}