export interface SmsSender {
  send(phone: string, text: string): Promise<void>;
}

export const SMS_SENDER = Symbol('SMS_SENDER');
