import { exigirSessao } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ROTULO_PAPEL } from "@/lib/formato";
import { TrocarSenhaForm } from "./senha-form";

export const metadata = { title: "Minha conta — Cliente Oculto" };

export default async function ContaPage() {
  const sessao = await exigirSessao();
  return (
    <div>
      <PageHeader titulo="Minha conta" descricao={sessao.nome} />
      <Card className="mb-6">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Nome</dt>
            <dd className="font-medium text-slate-900">{sessao.nome}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Perfil</dt>
            <dd className="font-medium text-slate-900">
              {ROTULO_PAPEL[sessao.papel] ?? sessao.papel}
            </dd>
          </div>
        </dl>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">Trocar senha</h2>
        <TrocarSenhaForm />
      </Card>
    </div>
  );
}
