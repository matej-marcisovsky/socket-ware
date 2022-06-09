import { v4 as uuidv4 } from "uuid";

import Client from "./Client";
import SocketError, { Recipients } from "./SocketError";

const MAX_AGE = 1000 * 60 * 60;

export default class Session {
    private maxClientsCount: number

    readonly clients: Client[] = []
    readonly id: string = uuidv4()

    updated: number = Date.now()

    get clientsCount() {
        return this.clients.length;
    }

    get isOutdated(): boolean {
        return Date.now() - this.updated > MAX_AGE;
    }

    constructor(maxClientsCount: number) {
        this.maxClientsCount = maxClientsCount;
    }

    joinClient(client: Client) {
        if (this.clientsCount === this.maxClientsCount) {
            throw new SocketError('Maximum number of clients exceeded.', Recipients.CurrentClient);
        }

        client.sessionId = this.id;
        this.clients.push(client);
    }

    update() {
        this.updated = Date.now();
    }
}
