import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";

export default class Client extends WebSocket {
    id: string = uuidv4()
    sessionId: string
}
