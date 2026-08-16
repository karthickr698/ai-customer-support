import { createContext, useContext, type ReactNode } from 'react';
import type { PlatformOperatorDto } from '@ai-customer-support/contracts';

const PlatformOperatorContext = createContext<PlatformOperatorDto | undefined>(undefined);

export function PlatformOperatorProvider({
  operator,
  children,
}: {
  readonly operator: PlatformOperatorDto;
  readonly children: ReactNode;
}) {
  return <PlatformOperatorContext.Provider value={operator}>{children}</PlatformOperatorContext.Provider>;
}

export function usePlatformOperator(): PlatformOperatorDto {
  const operator = useContext(PlatformOperatorContext);
  if (!operator) {
    throw new Error('usePlatformOperator must be used inside the platform console');
  }
  return operator;
}
