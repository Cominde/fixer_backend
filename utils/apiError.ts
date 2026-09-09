// @ desc this class is responable about opratenal errors (error that i can predect)
class apiError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith(4 as any) ? "fail" : "error";
    this.isOperational = true;
  }
}

export = apiError;
