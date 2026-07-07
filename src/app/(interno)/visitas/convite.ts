/** Mensagem padrão de convite ao avaliador (usada no WhatsApp). */
export function mensagemConvite(posto: string, link: string): string {
  return `Avaliação Cliente Oculto — ${posto}\nAcesse pelo celular para preencher a avaliação:\n${link}`;
}
