# Autobrowse AI (Chrome + Gemini Pro) — Guia de Uso com OmniRoute

## O que é

O Autobrowse AI é uma funcionalidade nativa do Google Chrome que permite ao Gemini Pro controlar o browser para executar tarefas de navegação — pesquisa, preenchimento de formulários, extração de dados — mediante supervisão humana.

## Requisitos

- Chrome atualizado (última versão estável)
- Conta Google com Gemini Pro (ou Gemini Advanced) ativa
- Localização: EUA (expansão gradual em curso)
- Idioma do dispositivo: Inglês
- Safe Browsing ativo
- Não utilizar modo Incógnito

## Como Ativar

1. Abrir o Chrome e clicar no ícone do Gemini (ou navegar a `chrome://gemini`)
2. Fazer login com a conta Google que tem Gemini Pro
3. Descrever a tarefa pretendida → revisar o plano proposto → **Start Task**
4. Para retomar controlo manual: **Take over task**

## Uso com OmniRoute

### Cenários de Integração

| Cenário                    | Como usar                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Testar endpoints OmniRoute | Pedir ao Autobrowse para navegar ao dashboard (`localhost:20128`) e verificar o estado dos providers         |
| Auditar SEO                | Autobrowse navega à página-alvo, OmniRoute executa a skill `seo_technical` via MCP para análise automatizada |
| Verificar providers        | Autobrowse abre cada URL de provider para confirmar disponibilidade visual                                   |
| Testes de UI               | Autobrowse executa fluxos de teste no dashboard do OmniRoute                                                 |

### Workflow Recomendado

1. **Autobrowse** para navegação e interação visual (formulários, cliques, scrolling)
2. **OmniRoute MCP tools** (`omniroute_seo_audit`, `omniroute_seo_content_analyze`, `omniroute_seo_schema_validate`) para análise técnica automatizada
3. **Gemini CLI** para scripting e automação headless (ver `docs/guides/GEMINI-SETUP.md`)

## Limitações

- Disponível apenas nos EUA (rollout gradual)
- Não usar com dados financeiros, de saúde ou confidenciais
- Requer confirmação humana antes de ações sensíveis
- Não substitui testes automatizados (Playwright/E2E)

## Referências

- [Gemini CLI Setup](./GEMINI-SETUP.md)
- [MCP Server docs](../frameworks/MCP-SERVER.md)
- [Skills framework](../frameworks/SKILLS.md)
