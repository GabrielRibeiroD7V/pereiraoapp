import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider';
import type { AuthGateway, AuthSession } from '../auth/types';
import { MessagesProvider, useMessageStatus } from './MessagesProvider';
import type { MessageRepository } from './repository';

it('descarta contagem pendente da conta anterior após logout e novo login', async () => {
  let emit!: (session: AuthSession | null) => void;
  let finishOld!: (value: number) => void;
  const first = { user: { id: 'first' } } as AuthSession;
  const gateway = {
    getSession: async () => first,
    subscribe: (listener: typeof emit) => { emit = listener; return () => {}; },
  } as AuthGateway;
  const repository = { unreadCount: vi.fn()
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValue(1),
  } as unknown as MessageRepository;
  function Probe() { return <output>{useMessageStatus().unreadCount}</output>; }
  render(<AuthProvider gateway={gateway}><MessagesProvider repository={repository}><Probe /></MessagesProvider></AuthProvider>);
  await waitFor(() => expect(finishOld).toBeDefined());
  act(() => emit(null));
  expect(screen.getByRole('status')).toHaveTextContent('0');
  act(() => emit({ user: { id: 'second' } } as AuthSession));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1'));
  await act(async () => finishOld(8));
  expect(screen.getByRole('status')).toHaveTextContent('1');
});
