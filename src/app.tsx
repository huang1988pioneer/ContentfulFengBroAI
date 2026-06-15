import { MetaProvider, Title } from "@solidjs/meta";
import { FileRoutes } from "@solidjs/start/router";
import { Router } from "@solidjs/router";
import { Suspense } from "solid-js";
import "./styles.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>鋒兄設定 | Contentful</Title>
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
