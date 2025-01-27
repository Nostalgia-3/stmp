import { existsSync } from "node:fs";

// TODO: everything
export class SettingsManager {
    c: Record<string, unknown>;

    constructor(settings = 'settings.json', default_: Record<string, unknown>) {
        if(!existsSync('resources')) {
            Deno.mkdirSync('resources');
        }

        if(!existsSync(`resources/${settings}`)) {
            Deno.writeTextFileSync(`resources/${settings}`, JSON.stringify(default_));
        }

        this.c = JSON.parse(Deno.readTextFileSync(`resources/${settings}`));
    }

    setBool(s: string, v: boolean) {
        
    }

    getBool(s: string): boolean | undefined {
        return;
    }
}