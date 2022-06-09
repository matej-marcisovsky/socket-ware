export enum Recipients {
    AllSessionClients = 'allSessionClients',
    CurrentClient = 'currentClient',
    OtherSessionClients = 'otherSessionClients'
}

export default class SocketError extends Error {
    recipients: Recipients

    constructor(message: string, recipients: Recipients = Recipients.AllSessionClients) {
        super(message);

        this.recipients = recipients;
    }
}
