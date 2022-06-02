import { test, expect } from "@playwright/test";

import { createAppFixture, createFixture, js } from "./helpers/create-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import { PlaywrightFixture } from "./helpers/playwright-fixture";

let fixture: Fixture;
let appFixture: AppFixture;

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      "app/routes/index.jsx": js`
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return deferred("pizza");
        }

        export default function Index() {
          let data = useLoaderData();
          return (
            <div>
              <Link to="/deferred">Deferred Route</Link>
              <Link to="/multiple-deferred">Multiple Deferred Route</Link>
              <Link to="/deferred-error">Deferred Error</Link>
              <Link to="/deferred-error-no-boundary">Deferred Error No Boundary</Link>
              <Link to="/redirect">Redirect</Link>
              {data}
            </div>
          )
        }
      `,

      "app/routes/redirect.jsx": js`
        import { deferred } from "@remix-run/node";
        export function loader() {
          return deferred({food: "pizza"}, { status: 301, headers: { Location: "/?redirected" } });
        }
      `,

      "app/routes/object.jsx": js`
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link } from "@remix-run/react";

        export function loader() {
          return deferred({data: "pizza"});
        }

        export default function Index() {
          let {data} = useLoaderData();
          return (
            <div>
              {data}
            </div>
          )
        }
      `,

      "app/routes/deferred.jsx": js`
        import * as React from "react";
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link, Deferred, useDeferred } from "@remix-run/react";

        export function loader() {
          return deferred({
            foo: "pizza",
            bar: new Promise(async (resolve, reject) => {
              // await new Promise(resolve => setTimeout(resolve, 500));
              resolve("hamburger");
            }),
          });
        }

        function DeferredComponent() {
          let deferred = useDeferred();
          return <div>{deferred}</div>;
        }

        export default function Index() {
          let {foo, bar} = useLoaderData();
          let [count, setCount] = React.useState(0);

          return (
            <div>
              {foo}
              <button onClick={() => setCount(count + 1)}>{count} Count</button>
              <Deferred data={bar}>
                <DeferredComponent />
              </Deferred>
            </div>
          )
        }
      `,

      "app/routes/deferred-error.jsx": js`
        import * as React from "react";
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link, Deferred, useDeferred } from "@remix-run/react";

        export function loader() {
          return deferred({
            foo: "pizza",
            bar: new Promise(async (resolve, reject) => {
              // await new Promise(resolve => setTimeout(resolve, 500));
              return reject(new Error("Oh, no!"));
              resolve("hamburger");
            }),
          });
        }

        function DeferredComponent() {
          let deferred = useDeferred();
          return <div>{deferred}</div>;
        }

        export default function Index() {
          let {foo, bar} = useLoaderData();
          let [count, setCount] = React.useState(0);

          return (
            <div>
              {foo}
              <button onClick={() => setCount(count + 1)}>{count} Count</button>
              <Deferred data={bar} error={<div>Oh, no!</div>}>
                <DeferredComponent />
              </Deferred>
            </div>
          )
        }
      `,

      "app/routes/deferred-error-no-boundary.jsx": js`
        import * as React from "react";
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link, Deferred, useDeferred } from "@remix-run/react";

        export function loader() {
          return deferred({
            foo: "pizza",
            bar: new Promise(async (resolve, reject) => {
              return reject(new Error("Oh, no!"));
            }),
          });
        }

        function DeferredComponent() {
          let deferred = useDeferred();
          return <div>{deferred}</div>;
        }

        export default function Index() {
          let {foo, bar} = useLoaderData();
          let [count, setCount] = React.useState(0);

          return (
            <div>
              {foo}
              <button onClick={() => setCount(count + 1)}>{count} Count</button>
              <Deferred data={bar}>
                <DeferredComponent />
              </Deferred>
            </div>
          )
        }

        export function ErrorBoundary() {
          return <div id="error-boundary">Error Boundary</div>;
        }
      `,

      "app/routes/multiple-deferred.jsx": js`
        import * as React from "react";
        import { deferred } from "@remix-run/node";
        import { useLoaderData, Link, Deferred, useDeferred } from "@remix-run/react";

        export function loader() {
          return deferred({
            foo: "pizza",
            bar: new Promise(async resolve => {
              // await new Promise(resolve => setTimeout(resolve, 500));
              resolve("hamburger");
            }),
            baz: new Promise(async resolve => {
              // await new Promise(resolve => setTimeout(resolve, 1000));
              resolve("soup");
            }),
          });
        }

        function DeferredComponent() {
          let deferred = useDeferred();
          return <div>{deferred}</div>;
        }

        export default function Index() {
          let {foo, bar, baz} = useLoaderData();
          let [count, setCount] = React.useState(0);

          return (
            <div>
              {foo}
              <Deferred data={bar}>
                <DeferredComponent />
              </Deferred>
              <Deferred data={baz}>
                <DeferredComponent />
              </Deferred>
            </div>
          )
        }
      `,
    },
  });

  appFixture = await createAppFixture(fixture);
});

test.afterAll(async () => appFixture.close());

test("works the same as json with no promise keys", async () => {
  let response = await fixture.requestDocument("/");
  expect(await response.text()).toMatch("pizza");

  response = await fixture.requestDocument("/object");
  expect(await response.text()).toMatch("pizza");
});

test("loads critical data first", async () => {
  let response = await fixture.requestDocument("/deferred");
  let text = await response.text();
  expect(text).toMatch("pizza");
  expect(text).toMatch('<div hidden id="S:0"><div>hamburger</div>');
  expect(text).toMatch('window.__remixDeferredData["routes/deferred"]["bar"]');
});

test("loads deferred data on page transitions", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  await app.clickLink("/deferred");
  let text = await app.getHtml();
  expect(text).toMatch("pizza");
  expect(text).toMatch("hamburger");
});

test("loads critical data first with multiple deferred", async () => {
  let response = await fixture.requestDocument("/multiple-deferred");
  let text = await response.text();
  expect(text).toMatch("pizza");
  expect(text).toMatch('<div hidden id="S:0"><div>hamburger</div>');
  expect(text).toMatch(
    'window.__remixDeferredData["routes/multiple-deferred"]["bar"]'
  );
  expect(text).toMatch('<div hidden id="S:1"><div>soup</div>');
  expect(text).toMatch(
    'window.__remixDeferredData["routes/multiple-deferred"]["baz"]'
  );
});

test("renders error boundary", async () => {
  let response = await fixture.requestDocument("/deferred-error");
  let text = await response.text();
  expect(text).toMatch("pizza");
  expect(text).toMatch('<div hidden id="S:0"><div>Oh, no!</div>');
  expect(text).toMatch(
    'window.__remixDeferredData["routes/deferred-error"]["bar"]'
  );
});

test("errored deferred data renders boundary", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  await app.clickLink("/deferred-error");
  let text = await app.getHtml();
  expect(text).toMatch("pizza");
  expect(text).not.toMatch("hamburger");
  expect(text).toMatch("Oh, no!");
});

test("errored deferred data renders route boundary on hydration", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/deferred-error-no-boundary");
  let boundary = await page.waitForSelector("#error-boundary");
  expect(await boundary.innerText()).toMatch("Error Boundary");
});

test("errored deferred data renders route boundary on transition", async ({
  page,
}) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  await app.clickLink("/deferred-error-no-boundary");
  let text = await app.getHtml();
  expect(text).toMatch("Error Boundary");
});

test("deferred response can redirect on document request", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/redirect");
  expect(app.page.url()).toMatch("?redirected");
});

test("deferred response can redirect on transition", async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page);
  await app.goto("/");
  await app.clickLink("/redirect");
  expect(app.page.url()).toMatch("?redirected");
});