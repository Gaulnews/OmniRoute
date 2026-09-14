# Gemini CLI, Superpowers & Autobrowse AI — Guia de Setup

## 1. Gemini CLI

### Instalação

```bash
npm install -g @google/gemini-cli
```

### Autenticação via API Key

```bash
export GEMINI_API_KEY="SUA_CHAVE"
gemini
```

Obtenha a chave em: <https://aistudio.google.com/apikey>

### Modos de Uso

| Modo       | Comando                           | Descrição                   |
| ---------- | --------------------------------- | --------------------------- |
| Interativo | `gemini`                          | Chat no terminal            |
| Headless   | `gemini -p "resumo deste código"` | Scripts/automação           |
| YOLO       | `gemini -y`                       | Aceita tudo automaticamente |
| Sandbox    | `gemini -s`                       | Execução isolada            |
| Worktree   | `gemini -w`                       | Git worktree separado       |

### Comandos Úteis

```bash
gemini mcp            # Gerenciar servidores MCP
gemini extensions     # Gerenciar extensões
gemini skills         # Gerenciar agent skills
gemini hooks          # Gerenciar hooks
gemini --resume latest  # Retomar última sessão
```

---

## 2. Superpowers (Plugin Claude Code)

### Instalação

```bash
claude plugin marketplace add obra/superpowers-marketplace
claude plugin install superpowers@superpowers-marketplace
```

### Skills Disponíveis

| Skill                            | Disparo                             |
| -------------------------------- | ----------------------------------- |
| `brainstorming`                  | Antes de qualquer trabalho criativo |
| `writing-plans`                  | Ao criar planos de implementação    |
| `executing-plans`                | Ao executar tarefas do plano        |
| `subagent-driven-development`    | Despachar subagentes por tarefa     |
| `verification-before-completion` | Validação final de critérios        |
| `requesting-code-review`         | Solicitar revisão de código         |
| `systematic-debugging`           | Debug metódico em 4 fases           |
| `test-driven-development`        | Workflow TDD                        |

### Validação

```bash
claude plugin list   # Deve mostrar superpowers
```

---

## 3. Caveman (Plugin Claude Code)

```bash
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman
```

Comandos: `/caveman lite` (economia moderada), `/caveman` (máximo), `/caveman:compress` (comprime CLAUDE.md).

---

## 4. claude-mem (Reparo Windows)

Se o worker ficar inatingível (`claude-mem worker unreachable`):

```bash
bash reparar-claude-mem-windows.sh
```

O script mata workers órfãos, limpa estado, repara o runtime e faz health check.

---

## 5. Autobrowse AI (Chrome + Gemini Pro)

### Requisitos

- Chrome atualizado (última versão)
- Conta Google com Gemini Pro ativa
- Localização: EUA (em expansão)
- Idioma do dispositivo: Inglês
- Safe Browsing ativo
- Não usar modo Incógnito

### Ativação

1. Chrome → ícone Gemini (ou `chrome://gemini`)
2. Login com conta Gemini Pro
3. Descrever tarefa → revisar plano → **Start Task**
4. **Take over task** para retomar controle manual

### Limitações

- Disponível apenas nos EUA (rollout gradual)
- Não usar com dados financeiros, saúde ou confidenciais
- Requer confirmação antes de ações sensíveis
