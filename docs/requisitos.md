# Requisitos

Checklist do desafio "Casa de Leilões online". Marcamos cada item conforme entra em `develop`.

## Premissas (explícitas ou implícitas no enunciado)

- Dois papéis, com cadastro e login: **leiloeiro** (cria e gerencia lotes, não dá lances) e **licitante** (deposita, dá lances, arremata).
- Lote = snapshot de um item da API externa + lance inicial, incremento mínimo, início e fim.
- Cancelar lote é permitido só **sem lances** (base). Cancelamento com lances e estorno automático é opcional.
- Dinheiro em centavos (inteiro), nunca float.

## Front-end

- [ ] Vitrine: lotes ao vivo, agendados e encerrados (cancelados ocultos)
- [ ] Painel do leiloeiro: buscar item na API, criar lote, cancelar lote sem lances, resultado e total recebido
- [ ] Sala do lote ao vivo: lance atual, histórico, posição, contagem regressiva, "ganhando"/"superado", sem recarregar
- [ ] Carteira: total, comprometido, disponível, depósito simulado
- [ ] Meus arremates: lotes com lance e vencidos, comprovante e link de compartilhamento
- [ ] Auditoria pública (sem login): histórico completo e veredito íntegro/adulterado
- [ ] Feedback claro para lance recusado: abaixo do mínimo, saldo insuficiente, já está ganhando, lote não iniciado, lote encerrado

## Back-end

- [ ] Regras de lance: só em lote ao vivo; 1º lance ≥ inicial; seguintes ≥ atual + incremento; líder não cobre o próprio lance
- [ ] API externa resiliente: snapshot do item no lote; vitrine, sala, auditoria e comprovante não dependem dela
- [ ] Saldo comprometido: disponível = total − comprometido; devolvido na hora ao ser superado
- [ ] Anti-sniping: lance nos últimos 2 min estende o fim em +2 min
- [ ] Liquidação: debita vencedor, credita leiloeiro, gera comprovante; sem lances fecha sem vencedor
- [ ] Histórico à prova de adulteração (alteração, remoção e inserção, inclusive direto no banco)
- [ ] Privacidade: licitante aparece só como apelido/hash parcial

## Requisitos não funcionais

- [ ] Deploy público
- [ ] Seed: 1 leiloeiro, 2 clientes, ao menos 1 lote publicado com lances abertos
- [ ] README detalhado (passo a passo, banco, comportamentos inesperados, técnica anti-adulteração)

## Opcionais

- [ ] Busca e filtro de lotes
- [ ] Cancelamento de lote com estorno automático
- [ ] Docker Compose
- [ ] Testes automatizados
- [ ] Dark mode

## Fora de escopo

Nota fiscal, revenda entre usuários, app nativo, recuperação de senha.
