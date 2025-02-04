// This is an incomplete list
type PayloadCommand = 'DISPATCH' | 'AUTHORIZE' | 'AUTHENTICATE' | 'SET_ACTIVITY';

type Scope = 'rpc' | 'rpc.activities.write' | 'rpc.notifications.read' | 'rpc.voice.read' | 'rpc.voice.write';

type User = {
    id: string, username: string, discriminator: string,
    global_name?: string, avatar?: string, bot?: boolean,
    system?: boolean, mfa_enabled?: boolean, banner?: boolean,
    accent_color?: number, locale?: string, verified?: boolean,
    email?: string, flags?: number, premium_type?: number,
    public_flags?: number, avatar_decoration_data?: Record<string, unknown>
};

type GenericPayload = {
    cmd: PayloadCommand,
    nonce?: string,
    evt?: string,
    data?: Record<string, unknown>,
    args?: Record<string, unknown>
}

type DispatchReadyPayload = {
    cmd: 'DISPATCH', evt: 'READY',
    data: {
        v: number,
        config: { cdn_host: string, api_endpoint: string, environment: string },
        user: User
    }
};

type ActivityJoinPayload = {
    cmd: 'DISPATCH', evt: 'ACTIVITY_JOIN',
    data: {
        secret: string
    }
};

type ActivityJoinRequestPayload = {
    cmd: 'DISPATCH', evt: 'ACTIVITY_JOIN_REQUEST',
    data: {
        user: User
    }
};

type ErrorPayload = {
    cmd: PayloadCommand, evt: 'ERROR', nonce: string,
    data: {
        code: number,
        message: string
    }
};

type AuthorizePayload = {
    cmd: 'AUTHORIZE', nonce: string,
    args: {
        client_id: string, scopes: Scope[],
        rpc_token?: string, username?: string
    }
};

type AuthorizeResponsePayload = {
    cmd: 'AUTHORIZE', nonce: string,
    data: {
        code: string
    }
};

type SetActivityPayload = {
    cmd: 'SET_ACTIVITY', nonce: string,
    args: {
        pid: number,
        activity: Activity
    }
};

type Payload
    = GenericPayload & DispatchReadyPayload
    | GenericPayload & ActivityJoinPayload
    | GenericPayload & ActivityJoinRequestPayload
    | GenericPayload & AuthorizePayload
    | GenericPayload & ErrorPayload
    | GenericPayload & AuthorizeResponsePayload
    | GenericPayload & SetActivityPayload
;

type Emoji = { name: string, id?: string, animated?: boolean };
type Party = { id?: string, size?: [number, number] };
type Assets = { large_image?: string, large_text?: string, small_image?: string, small_text?: string };
type Secrets = { join?: string, spectate?: string, match?: string };
type Button = { label: string, url: string };

export enum ActivityType {
    Playing     = 0,
    Streaming   = 1,
    Listening   = 2,
    Watching    = 3,
    Competing   = 5
}

export type Activity = {
    name?: string, type: ActivityType,
    url?: string, created_at?: number,
    timestamps?: { start?: number, end?: number },
    application_id?: string, details?: string, state?: string,
    emoji?: Emoji, party?: Party, assets?: Assets, secrets?: Secrets,
    instance?: boolean, flags?: number, buttons?: Button[]
};

export class DiscordIPC {
    protected pipe?: Deno.FsFile;
    protected id: string;
    protected buf: Uint8Array;

    protected writePacket(opcode: number, data: Payload) {
        const j = JSON.stringify(data);
        const b = new Uint8Array(4+4+j.length);
        const dv = new DataView(b.buffer);
    
        dv.setUint32(0, opcode, true);
        dv.setUint32(4, j.length, true);
        b.set(new TextEncoder().encode(j), 8);
    
        if(this.pipe) this.pipe.writeSync(b);
    }

    protected getPacket() {
        this.pipe?.readSync(this.buf);
        if(this.buf[0] == 0) return;
        const dv = new DataView(this.buf.buffer);
        const opcode = dv.getUint32(0, true);
        const datalen = dv.getUint32(4, true);
    
        return { opcode, data: JSON.parse(new TextDecoder().decode(this.buf.subarray(8, 8+datalen))) as Payload };
    }

    constructor(clientId: string) {
        if(Deno.build.os != 'windows') {
            throw new Error(`Operating system "${Deno.build.os}" is not equal to "windows"`);
        }

        this.id = clientId;
        // There *shouldn't* be anything bigger than 16KiB
        this.buf = new Uint8Array(1024*16);
    }

    /**
     * Connect to the discord IPC
     * @returns True if successfully connected; false otherwise
     */
    connect() {
        try {
            this.pipe = Deno.openSync('\\\\.\\pipe\\discord-ipc-0', { read: true, write: true });
            this.writePacket(0, { v: 1, client_id: this.id } as unknown as Payload);
            const p = this.getPacket();

            if(!p || p.data.cmd != 'DISPATCH') {
                this.pipe?.close();
                return false;
            }

            // Authorization won't be handled until I decide to increase the
            // capabilities of this for all of the things, although I'm not even
            // sure if it'll work because of discord's hatred of IPC

            return true;
        } catch(e) {
            this.pipe?.close();
            console.log(e);
            return false;
        }
    }

    setActivity(activity: Activity) {
        this.writePacket(1, { cmd: 'SET_ACTIVITY', nonce: 'set-activity-deno-ipc', args: { pid: Deno.pid, activity } });
        if(this.getPacket()?.data.cmd != 'SET_ACTIVITY') return false;
        return true;
    }
}