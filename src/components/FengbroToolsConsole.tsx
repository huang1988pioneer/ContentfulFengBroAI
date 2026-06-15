import { createSignal, For, Match, Switch } from "solid-js";

type ToolId = "price" | "phone" | "tube" | "finance";

const tools: Array<{ id: ToolId; label: string; eyebrow: string }> = [
  { id: "price", label: "鋒兄比價", eyebrow: "PRICE WATCH" },
  { id: "phone", label: "手機比價", eyebrow: "PHONE COMPARE" },
  { id: "tube", label: "鋒兄Tube", eyebrow: "FENGBRO TUBE" },
  { id: "finance", label: "鋒兄金融", eyebrow: "MARKET BOARD" }
];

const navItems = [
  "鋒兄首頁",
  "鋒兄儀表",
  "鋒兄訂閱",
  "鋒兄會員",
  "鋒兄筆記",
  "鋒兄常用",
  "鋒兄圖片",
  "鋒兄影片",
  "鋒兄音樂",
  "鋒兄文件",
  "鋒兄語錄",
  "鋒兄銀行"
];

const videos = [
  "中共挺2万亿！六安预测中美AI决战",
  "推背图中的紫薇圣人 大转折：灭共倒计时",
  "周易预判：闭关锁国加速 资产锁死",
  "习近平二十大量盘？硬盘封锁政治悬崖",
  "天灾or政治博弈 周易揭秘山西矿难真相",
  "习近平禁上 TikTok 面临权相激烈反噬",
  "崩盘预警：中国楼市与A股同步触雷",
  "升卦断中美注定一战？"
];

const markets = [
  ["Nasdaq-100", "44,169.04", "+2.18%"],
  ["S&P 500 Index", "7,431.46", "+0.35%"],
  ["NASDAQ Composite", "25,888.84", "+1.76%"],
  ["台灣加權指數", "13,371.47", "+2.08%"],
  ["0050 Value ETF", "17.68", "-1.74%"],
  ["Silver Fix Price", "41.43", "+0.28%"],
  ["Bitcoin", "105,019", "+0.39%"],
  ["Gold COMEX", "4,239.9", "+0.44%"]
];

export function FengbroToolsConsole() {
  const [active, setActive] = createSignal<ToolId>("price");
  const activeTool = () => tools.find((tool) => tool.id === active()) ?? tools[0];

  return (
    <main class="app-shell">
      <aside class="sidebar">
        <div class="brand-card">
          <span class="brand-mark">鋒</span>
          <div>
            <small>FENGBRO</small>
            <strong>AI Appwrite</strong>
          </div>
        </div>

        <div class="mode-card">
          <span class="mini-icon">□</span>
          <div>
            <small>DESIGN MODE</small>
            <strong>Impeccable 2026</strong>
          </div>
        </div>

        <nav class="nav-list" aria-label="主要功能">
          <For each={navItems}>
            {(item) => (
              <a class="nav-item" href="#">
                <span class="mini-icon">{item.slice(2, 3)}</span>
                <span>{item}</span>
              </a>
            )}
          </For>

          <button class="nav-item nav-parent" type="button">
            <span class="mini-icon">工</span>
            <span>鋒兄工具</span>
            <b>⌄</b>
          </button>
          <For each={tools}>
            {(tool) => (
              <button
                type="button"
                class={`nav-item nav-child ${active() === tool.id ? "is-active" : ""}`}
                onClick={() => setActive(tool.id)}
              >
                <span class="mini-icon">{tool.label.slice(2, 3)}</span>
                <span>{tool.label}</span>
              </button>
            )}
          </For>
        </nav>

        <div class="workspace-card">
          <small>Unified Household Workspace</small>
          <p>跨資料、訂閱、影音、金融的一體化工作台。</p>
        </div>
      </aside>

      <section class="surface">
        <header class="topbar">
          <div>
            <small>ACTIVE SURFACE</small>
            <strong>{activeTool().label}</strong>
          </div>
          <div class="top-pills">
            <span>Today<br />6月15日星期一</span>
            <span>Modules<br />16 個模組</span>
          </div>
        </header>

        <section class="console-card">
          <div class="console-heading">
            <small>CONSOLE VIEW</small>
            <h1>鋒兄工具</h1>
            <p>工具模組集中入口與手機比價工作台。</p>
          </div>

          <div class="tool-tabs" role="tablist" aria-label="鋒兄工具子項目">
            <For each={tools}>
              {(tool) => (
                <button
                  type="button"
                  class={active() === tool.id ? "is-selected" : ""}
                  onClick={() => setActive(tool.id)}
                >
                  {tool.label}
                </button>
              )}
            </For>
          </div>

          <Switch>
            <Match when={active() === "price"}>
              <PriceTool />
            </Match>
            <Match when={active() === "phone"}>
              <PhoneTool />
            </Match>
            <Match when={active() === "tube"}>
              <TubeTool />
            </Match>
            <Match when={active() === "finance"}>
              <FinanceTool />
            </Match>
          </Switch>
        </section>
      </section>

      <button class="global-action" type="button">全域搜尋</button>
    </main>
  );
}

function ToolTitle(props: { id: ToolId; eyebrow: string; title: string; copy: string }) {
  return (
    <div class={`tool-panel ${props.id}`}>
      <div class="tool-title">
        <span class="tool-dot">{props.title.slice(0, 1)}</span>
        <div>
          <small>{props.eyebrow}</small>
          <h2>{props.title}</h2>
          <p>{props.copy}</p>
        </div>
      </div>
    </div>
  );
}

function PriceTool() {
  return (
    <section class="module-stack amber-module">
      <ToolTitle id="price" eyebrow="PRICE WATCH" title="鋒兄比價" copy="貼上商品連結、取得目前價格與歷史價格圖表。" />
      <div class="query-box dashed">
        <label>
          <span>商品網址</span>
          <div class="inline-input">
            <input value="https://24h.pchome.com.tw/prod/DRAH-CO-A900I8363" readOnly />
            <button type="button">重新比價</button>
          </div>
        </label>
        <div class="split-inputs">
          <input value="BigGo API" readOnly />
          <input value="本地估價" readOnly />
        </div>
      </div>
      <div class="white-block">
        <div class="product-row">
          <div>
            <strong>Micron 美光 Crucial T500 2TB PCIe Gen4 NVMe SSD</strong>
            <p>來源：BigGo API · 更新：2026-06-14T05:42:03Z</p>
          </div>
          <b class="price">10,735 TWD</b>
        </div>
        <div class="metric-grid">
          <div><small>當前價格</small><strong>10,735 TWD</strong></div>
          <div class="danger"><small>歷史最高價</small><strong>10,735 TWD</strong></div>
          <div class="success"><small>歷史最低價</small><strong>10,735 TWD</strong></div>
        </div>
        <div class="chart-card">
          <div class="chart-head">
            <div><small>PRICE TREND</small><strong>歷史價格走勢</strong></div>
            <div class="chart-stats"><span>最高價<br />10,735 TWD</span><span>變化<br />0 TWD</span></div>
          </div>
          <div class="empty-chart"><span /></div>
        </div>
      </div>
    </section>
  );
}

function PhoneTool() {
  const phones = [
    ["Samsung A17", "SAMSUNG", "NT$ 4,990"],
    ["Samsung A17 6G 128GB", "SAMSUNG", "NT$ 4,990"]
  ];

  return (
    <section class="module-stack blue-module">
      <ToolTitle id="phone" eyebrow="PHONE COMPARE" title="手機比價" copy="根據地標網通與蘋果、三星價格資料，可搜尋 iPhone 17、Samsung 26 等機型。" />
      <div class="dual-search">
        <div><strong>蘋果手機搜尋</strong><div class="inline-input"><input value="iPhone 17" readOnly /><button type="button">搜尋中</button></div></div>
        <div><strong>三星手機搜尋</strong><div class="inline-input"><input value="Samsung 26" readOnly /><button type="button">搜尋中</button></div></div>
      </div>
      <div class="chart-card blue-border">
        <div class="chart-head"><div><small>LANDTOP CHART</small><strong>地標網通 VS 參考均價</strong></div><b>⌁</b></div>
        <For each={phones}>
          {(phone) => (
            <div class="bar-row">
              <strong>{phone[0]}<small>{phone[1]}</small></strong>
              <span>地標</span>
              <i><b /></i>
              <em>{phone[2]}</em>
            </div>
          )}
        </For>
      </div>
      <div class="phone-grid">
        <For each={phones}>
          {(phone) => (
            <article class="phone-card">
              <strong>{phone[0]}</strong>
              <small>{phone[1]}</small>
              <div class="phone-metrics">
                <span>空機售價<b>{phone[2]}</b></span>
                <span>參考均價<b>NT$ 4,910</b></span>
                <span>最佳通路<b>地標網通</b></span>
              </div>
            </article>
          )}
        </For>
      </div>
      <div class="chart-card tall blue-border">
        <div class="chart-head">
          <div><small>WEEKLY HISTORY</small><strong>地標網通歷史價格</strong></div>
          <div class="chart-stats"><span>歷史最低<br />NT$ 4,990</span><span>歷史最高<br />NT$ 4,990</span></div>
        </div>
        <div class="line-chart" />
      </div>
    </section>
  );
}

function TubeTool() {
  return (
    <section class="module-stack rose-module">
      <ToolTitle id="tube" eyebrow="FENGBRO TUBE" title="鋒兄Tube" copy="追蹤指定 YouTube 頻道最新影片，每個頻道顯示 10 筆，目前追蹤 24 個頻道。" />
      <div class="headline-list">
        <strong>3 天內新影片 · 34 部</strong>
        <div>
          <For each={videos}>{(title) => <span>{title}<small>06/14 上午10:55</small></span>}</For>
        </div>
      </div>
      <VideoShelf title="吉利小劇場" />
      <VideoShelf title="一個族人" />
    </section>
  );
}

function VideoShelf(props: { title: string }) {
  return (
    <div class="video-shelf">
      <div class="block-head"><strong>{props.title}</strong><button type="button">10 部影片</button></div>
      <div class="video-grid">
        <For each={videos}>
          {(title, index) => (
            <article class="video-card">
              <div class={`thumb thumb-${(index() % 4) + 1}`}>{title.slice(0, 12)}</div>
              <strong>{title}</strong>
              <small>06/{14 - index()} 上午{10 + index()}:55</small>
            </article>
          )}
        </For>
      </div>
    </div>
  );
}

function FinanceTool() {
  return (
    <section class="module-stack green-module">
      <ToolTitle id="finance" eyebrow="MARKET BOARD" title="鋒兄金融" copy="CNN 恐慌指數、美股、台股、能源、加密、商品市場的每日摘要。" />
      <div class="market-hero">
        <div>
          <small>Silver Fix Price</small>
          <strong>41.43</strong>
          <span>市場溫度穩定 · refreshed 8:20pm</span>
        </div>
        <b>CURRENT<br />41.43</b>
      </div>
      <section class="market-section">
        <div class="block-head"><strong>市場追蹤</strong><span>8 筆</span></div>
        <div class="market-grid">
          <For each={markets}>
            {(market) => (
              <article class="market-card">
                <small>{market[0]}</small>
                <strong>{market[1]}</strong>
                <em class={market[2].startsWith("-") ? "down" : ""}>{market[2]}</em>
                <div class="sparkline" />
              </article>
            )}
          </For>
        </div>
      </section>
    </section>
  );
}
