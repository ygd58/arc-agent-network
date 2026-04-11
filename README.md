# arc-agent-network

**TR** | Arc Testnet üzerinde ERC-8004 + ERC-8183 + Claude AI ile çalışan tam otonom agent ağı.
**EN** | Fully autonomous AI agent network on Arc Testnet — ERC-8004 identity, ERC-8183 commerce, Claude AI decisions.

---

## Ne Yapar / What It Does

3 otonom AI agent birbirleriyle koordine olarak tam bir iş döngüsünü onchain tamamlar:
[Orchestrator] → Claude AI ile görev belirle
↓
[ERC-8183] → İş oluştur + USDC escrow'a kilitle
↓
[Worker] → Claude AI ile görevi tamamla + teslim et
↓
[Evaluator] → Claude AI ile değerlendir + onayla
↓
[Onchain] → USDC ödeme + ERC-8004 reputation

---

## Canlı Demo / Live Demo
ERC-8004 Kayıtlar:
Orchestrator  #1801
Worker        #1802
Evaluator     #1803
ERC-8183 İş:
Job ID        #1514
Görev         Analyze Arc testnet transaction patterns
Durum         Completed ✓
Ödeme: USDC escrow → Worker cüzdanına aktarıldı
Explorer: https://testnet.arcscan.app

---

## Kurulum / Installation

```bash
git clone https://github.com/ygd58/arc-agent-network
cd arc-agent-network
npm install
```

---

## Kullanım / Usage

```bash
# 3 farklı cüzdan için private key set et
export ORCHESTRATOR_KEY=0xPRIVATE_KEY_1
export WORKER_KEY=0xPRIVATE_KEY_2
export EVALUATOR_KEY=0xPRIVATE_KEY_3

# Claude AI için (opsiyonel — yoksa mock kullanır)
export ANTHROPIC_API_KEY=your_api_key

# Ağı başlat
npx tsx src/index.ts
```

**Testnet USDC almak için:** https://faucet.circle.com → Arc Testnet

---

## Mimari / Architecture
src/
├── agents/
│   └── base.ts       # ArcAgent sınıfı (ERC-8004 + ERC-8183)
├── contracts/
│   └── index.ts      # ABI + kontrat adresleri
├── utils/
│   ├── chain.ts      # viem client, USDC utils
│   └── claude.ts     # Claude API entegrasyonu
└── index.ts          # 6 fazlı agent network orkestrasyonu

---

## 6 Faz / 6 Phases

| Faz | İşlem |
|---|---|
| 1 | ERC-8004: 3 agent zincire kayıt |
| 2 | Orchestrator: Claude AI ile görev belirle |
| 3 | ERC-8183: İş oluştur + USDC escrow |
| 4 | Worker: Claude AI ile görevi tamamla |
| 5 | Evaluator: Claude AI ile değerlendir |
| 6 | Onchain: USDC öde + reputation kaydet |

---

## Kontratlar / Contracts (Arc Testnet)

| Kontrat | Adres |
|---|---|
| ERC-8004 IdentityRegistry | 0x8004A818BFB912233c491871b3d84c89A494BD9e |
| ERC-8004 ReputationRegistry | 0x8004B663056A597Dffe9eCcC1965A193B7388713 |
| ERC-8183 AgenticCommerce | 0x0747EEf0706327138c69792bF28Cd525089e4583 |
| USDC | 0x3600000000000000000000000000000000000000 |

---

## Network

| | |
|---|---|
| RPC | https://rpc.testnet.arc.network |
| Chain ID | 5042002 |
| Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com |

---

## İlgili Araçlar / Related Tools

- [arc-cli](https://github.com/ygd58/arc-cli)
- [arc-usdc](https://github.com/ygd58/arc-usdc)
- [arc-batch](https://github.com/ygd58/arc-batch)
- [arc-agent](https://github.com/ygd58/arc-agent)

## Lisans / License

MIT
