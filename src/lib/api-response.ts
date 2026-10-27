export type ApiResponse<T> = {
  status: number;
  message: string;
  data: T | null;
};

export const ok = <T>(
  data: T,
  message = "OK",
  status = 200,
): ApiResponse<T> => ({ status, message, data });
export const fail = (status: number, message: string): ApiResponse<never> => ({
  status,
  message,
  data: null,
});
