import { createAsync, query } from "@solidjs/router";
import { For, Show } from "solid-js";
import { getContentfulConfigStatus } from "../lib/contentful";

const loadContentfulStatus = query(async () => {
  "use server";
  return getContentfulConfigStatus();
}, "contentful-status");

export default function Home() {
  const status = createAsync(() => loadContentfulStatus());

  return (
    <main class="page-shell">
      <section class="hero">
        <p class="eyebrow">SolidStart + Contentful</p>
        <h1>ContentfulFengBroAI</h1>
        <p class="lede">
          Contentful connection settings are read from server-side environment
          variables, so API tokens stay out of the browser.
        </p>
      </section>

      <section class="panel" aria-labelledby="contentful-settings">
        <div class="panel-heading">
          <div>
            <h2 id="contentful-settings">Contentful environment variables</h2>
            <p>
              Fill these in through `.env.local` or your deployment provider.
              The management token is only needed for table initialization.
            </p>
          </div>
          <a class="test-link" href="/api/test-contentful">
            Test API
          </a>
        </div>

        <Show when={status()} fallback={<p>Loading settings...</p>}>
          {(settings) => (
            <dl class="settings-list">
              <For each={settings()}>
                {(item) => (
                  <div class="setting-row">
                    <dt>{item.name}</dt>
                    <dd class={item.configured ? "configured" : "missing"}>
                      {item.configured ? item.displayValue : "Missing"}
                    </dd>
                  </div>
                )}
              </For>
            </dl>
          )}
        </Show>
      </section>
    </main>
  );
}
