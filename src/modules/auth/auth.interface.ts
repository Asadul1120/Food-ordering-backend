export interface IRegisterInput {
  name: string;
  phone?: string;
  email: string;
  password: string;
}

export interface ILoginInput {
  email: string;
  password: string;
}

export interface ITokenPayload {
  userId: string;
}
export interface IVerifyOtpInput {
  email: string;
  otp: string;
}
