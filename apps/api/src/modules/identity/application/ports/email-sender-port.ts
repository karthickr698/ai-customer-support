export type AuthEmailMessage =
  | {
      readonly kind: 'email_verification';
      readonly to: string;
      readonly verifyUrl: string;
    }
  | {
      readonly kind: 'password_reset';
      readonly to: string;
      readonly resetUrl: string;
    };

export interface EmailSenderPort {
  send(message: AuthEmailMessage): Promise<void>;
}
