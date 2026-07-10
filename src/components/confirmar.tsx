"use client";

import { useTransition } from "react";

/**
 * Form de server action com CONFIRMAÇÃO nativa antes de submeter — padrão
 * do sistema para toda ação destrutiva (excluir, revogar, cancelar,
 * desativar). Substitui o <form action={...}> direto nesses casos.
 *
 * IMPORTANTE: o <form> NÃO recebe `action`. Se recebesse, o React 19 wira a
 * server action ao submit nativo e passa a executá-la mesmo quando um
 * preventDefault no onSubmit/onClick tenta cancelar (corrida observada em
 * testes — o item era excluído mesmo com "Cancelar"). Aqui o onSubmit SEMPRE
 * previne o submit e só chama a action manualmente após o usuário confirmar.
 * Como todas as ações de exclusão do sistema já vêm com o id via `.bind()`
 * (ou closure), o FormData é dispensável.
 */
export function FormConfirmar({
  action,
  mensagem,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mensagem: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, iniciar] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (window.confirm(mensagem)) {
          const fd = new FormData(e.currentTarget);
          iniciar(() => action(fd));
        }
      }}
    >
      {children}
    </form>
  );
}
