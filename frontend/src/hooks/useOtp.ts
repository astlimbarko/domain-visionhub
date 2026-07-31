import { useMutation } from '@tanstack/react-query';
import { solicitarOtp } from '@/services/otp.service';

export function useSolicitarOtp() {
  return useMutation({ mutationFn: solicitarOtp });
}
