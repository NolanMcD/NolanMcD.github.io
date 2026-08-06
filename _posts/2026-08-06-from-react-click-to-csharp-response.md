---
title: "From React Click to C# Response"
date: 2026-08-06
categories: [code, interviews]
excerpt: "A practical tour of C#, ASP.NET Core, and React through one full-stack feature—from browser state and JSON to dependency injection and an API response."
---

I recently interviewed with a team whose main stack is **C#, ASP.NET Core, and React**. The fastest way to become useful in that stack is not to memorize three independent technologies. It is to understand the boundary between them.

This walkthrough builds one small feature: a task list that loads existing tasks and creates a new one. The domain is deliberately boring. That leaves room to focus on the architecture, conventions, and interview questions hiding underneath it.

<div class="dotnet-stack-map" aria-label="A React event sends JSON over HTTP to an ASP.NET Core endpoint, which receives dependencies and calls C sharp domain code before returning JSON">
  <div><span>Browser</span><strong>React</strong><small>State, events, rendering</small></div>
  <b aria-hidden="true">→</b>
  <div><span>Boundary</span><strong>HTTP + JSON</strong><small>Requests, status codes, DTOs</small></div>
  <b aria-hidden="true">→</b>
  <div><span>Server</span><strong>ASP.NET Core</strong><small>Routing, DI, middleware</small></div>
  <b aria-hidden="true">→</b>
  <div><span>Language</span><strong>C#</strong><small>Types, async, domain logic</small></div>
</div>

## The 30-second mental model

- **C#** is the language. It supplies the type system, records, classes, interfaces, generics, LINQ, tasks, and `async`/`await`.
- **.NET** is the runtime, standard library, SDK, and application platform.
- **ASP.NET Core** is .NET’s web framework. It supplies the HTTP server, routing, middleware pipeline, dependency-injection container, configuration, logging, authentication hooks, and API result types.
- **React** is a UI library. Components render from props and state; event handlers update state; Effects synchronize a component with systems outside React.

The interview version is even shorter: **React is the client, ASP.NET Core is the HTTP boundary, and C# is the server-side language.**

## Part 1: model the server in C#

C# will feel familiar if you know Java, Python, or C++. The important difference is how much the compiler can prove before the application runs.

```csharp
public sealed record TaskItem(
    Guid Id,
    string Title,
    bool IsComplete,
    DateTimeOffset CreatedAt);

public sealed record CreateTaskRequest(string Title);
```

A `record` is a concise reference type with value-based equality. These two records play different roles:

- `TaskItem` is the representation returned by the application.
- `CreateTaskRequest` is the input contract. The client is not allowed to choose an ID, completion state, or creation time.

That separation is a small security and maintainability habit: do not bind arbitrary client JSON directly onto a database entity.

### An interface and repository

```csharp
public interface ITaskRepository
{
    Task<IReadOnlyList<TaskItem>> GetAllAsync(
        CancellationToken cancellationToken);

    Task<TaskItem?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken);

    Task<TaskItem> CreateAsync(
        string title,
        CancellationToken cancellationToken);
}
```

Several common C# ideas appear here:

- `IReadOnlyList<T>` communicates that callers may read the result but should not mutate the collection.
- `Task<T>` represents an asynchronous operation that will eventually produce a `T`.
- `CancellationToken` lets abandoned HTTP requests propagate cancellation toward database or network work.
- The `I` prefix for interfaces is a widespread .NET convention.

For the demo, an in-memory implementation is enough:

```csharp
using System.Collections.Concurrent;

public sealed class InMemoryTaskRepository : ITaskRepository
{
    private readonly ConcurrentDictionary<Guid, TaskItem> _tasks = new();

    public Task<IReadOnlyList<TaskItem>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        IReadOnlyList<TaskItem> result = _tasks.Values
            .OrderByDescending(task => task.CreatedAt)
            .ToList();

        return Task.FromResult(result);
    }

    public Task<TaskItem> CreateAsync(
        string title,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var task = new TaskItem(
            Guid.NewGuid(),
            title,
            false,
            DateTimeOffset.UtcNow);

        _tasks[task.Id] = task;
        return Task.FromResult(task);
    }

    public Task<TaskItem?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _tasks.TryGetValue(id, out var task);
        return Task.FromResult(task);
    }
}
```

`var` still produces a statically typed variable—the compiler infers the type. LINQ’s `OrderByDescending` and `ToList` read like a collection pipeline. The `ConcurrentDictionary` makes individual dictionary operations thread-safe, though a real multi-step business invariant may still require a lock or database transaction.

This implementation returns completed tasks only because memory access is immediate. With Entity Framework Core, the repository would normally `await` calls such as `ToListAsync(cancellationToken)` and `SaveChangesAsync(cancellationToken)`.

## Part 2: expose the behavior with ASP.NET Core

A modern ASP.NET Core application can define small APIs directly in `Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ITaskRepository, InMemoryTaskRepository>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("react-client", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

app.UseHttpsRedirection();
app.UseCors("react-client");

app.MapGet("/api/tasks", async (
    ITaskRepository repository,
    CancellationToken cancellationToken) =>
{
    var tasks = await repository.GetAllAsync(cancellationToken);
    return Results.Ok(tasks);
});

app.MapGet("/api/tasks/{id:guid}", GetTask);
app.MapPost("/api/tasks", CreateTask);

app.Run();

static async Task<IResult> GetTask(
    Guid id,
    ITaskRepository repository,
    CancellationToken cancellationToken)
{
    var task = await repository.GetByIdAsync(id, cancellationToken);
    return task is null ? Results.NotFound() : Results.Ok(task);
}

static async Task<IResult> CreateTask(
    CreateTaskRequest request,
    ITaskRepository repository,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(request.Title))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["title"] = ["A title is required."]
        });
    }

    var task = await repository.CreateAsync(
        request.Title.Trim(),
        cancellationToken);

    return Results.Created($"/api/tasks/{task.Id}", task);
}
```

### What the framework is doing

The two halves of `Program.cs` serve different purposes:

1. `builder.Services...` configures the dependency-injection container.
2. `app...` configures the HTTP request pipeline and endpoints.

When a request reaches an endpoint, ASP.NET Core:

1. matches the HTTP method and route;
2. deserializes JSON into `CreateTaskRequest`;
3. resolves `ITaskRepository` from dependency injection;
4. supplies a request-linked `CancellationToken`;
5. invokes the endpoint;
6. serializes the result back to JSON.

`AddSingleton` creates one repository for the application’s lifetime. That is appropriate for this in-memory demo. Common lifetimes are:

| Lifetime | One instance per… | Typical use |
|---|---|---|
| Singleton | application | stateless shared services, immutable caches |
| Scoped | HTTP request | EF Core database contexts, request-level work |
| Transient | resolution | small, stateless, cheap services |

Do not inject a scoped service into a singleton: the singleton would accidentally retain request-scoped state beyond its intended lifetime.

### Why the response codes matter

- `200 OK` returns the current collection.
- `201 Created` says a resource was created and provides its URL in the `Location` header.
- `400 Bad Request` with validation details tells the client its input was invalid.
- Unexpected exceptions should become consistent server errors through centralized exception-handling middleware—not scattered `try/catch` blocks that hide failures.

### Minimal APIs versus controllers

This example uses minimal APIs because the complete request flow fits on one screen. Many established codebases use controllers:

```csharp
[ApiController]
[Route("api/tasks")]
public sealed class TasksController : ControllerBase
{
    private readonly ITaskRepository _repository;

    public TasksController(ITaskRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TaskItem>>> GetAll(
        CancellationToken cancellationToken)
    {
        return Ok(await _repository.GetAllAsync(cancellationToken));
    }
}
```

The packaging differs; routing, model binding, dependency injection, status codes, middleware, and async I/O are the same concepts.

## Part 3: call the API from React

The client needs three kinds of state: the server data, the form input, and the request status.

```jsx
import { useEffect, useState } from "react";

const API_URL = "https://localhost:7001/api/tasks";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadTasks() {
      try {
        const response = await fetch(API_URL, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        setTasks(await response.json());
        setStatus("ready");
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("Could not load tasks.");
          setStatus("error");
        }
      }
    }

    loadTasks();
    return () => controller.abort();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setStatus("saving");
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const created = await response.json();

      setTasks(current => [created, ...current]);
      setTitle("");
      setStatus("ready");
    } catch {
      setError("Could not create the task.");
      setStatus("error");
    }
  }

  if (status === "loading") return <p>Loading…</p>;

  return (
    <section>
      <h1>Tasks</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="task-title">New task</label>
        <input
          id="task-title"
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
        <button disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Add"}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      <ul>
        {tasks.map(task => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </section>
  );
}
```

### The React ideas worth explaining aloud

- State is immutable. `setTasks(current => [created, ...current])` creates a new array instead of mutating the old one.
- A controlled input gets its value from state and reports changes through `onChange`.
- The `key` tells React which list item corresponds to which server entity. A stable database ID is safer than an array index.
- The Effect synchronizes the component with an external system: the API. Its cleanup aborts work when the component unmounts.
- `response.ok` must be checked. `fetch` rejects for network failures, not for every `404` or `500` response.
- Functional state updates avoid closing over a stale `tasks` value when the next state depends on the previous state.

In a larger application, I would usually move server-state concerns to a library such as TanStack Query rather than rebuilding caching, retries, deduplication, and invalidation in every component. The underlying HTTP contract remains the same.

## Part 4: trace one click end to end

<div class="stack-request-trace">
  <ol>
    <li><strong>Event</strong><span>The form calls <code>handleSubmit</code>.</span></li>
    <li><strong>Request</strong><span>React sends <code>POST /api/tasks</code> with JSON.</span></li>
    <li><strong>Binding</strong><span>ASP.NET Core creates a <code>CreateTaskRequest</code>.</span></li>
    <li><strong>Resolution</strong><span>DI supplies the registered repository.</span></li>
    <li><strong>Domain work</strong><span>C# creates and stores the task.</span></li>
    <li><strong>Response</strong><span>The API returns <code>201 Created</code> and JSON.</span></li>
    <li><strong>Render</strong><span>React replaces state and renders the new list item.</span></li>
  </ol>
</div>

If I can narrate that path, I can orient myself in an unfamiliar full-stack codebase: start from the browser event or network request, find the route, follow the injected service, inspect the persistence boundary, then trace the response back into state.

## Part 5: the production questions

### Where does validation belong?

Both sides validate for different reasons. React provides fast feedback; the API remains authoritative because clients can be bypassed. Business rules belong behind the HTTP boundary, not only inside a component.

### What is CORS actually doing?

CORS is a browser security mechanism governing whether frontend code from one origin may read responses from another. The server should allow specific trusted origins. It is not authentication, and `AllowAnyOrigin` is not a convenient production default.

### Why async all the way?

Database and network calls spend time waiting. `await` lets the request thread return to the pool during that wait instead of blocking it. Calling `.Result` or `.Wait()` undermines that model and can create starvation or deadlock problems in the wrong environment.

### How would authentication fit?

The client proves identity with a secure session or token. ASP.NET Core authentication middleware validates it and builds a `ClaimsPrincipal`; authorization policies decide whether that identity may use an endpoint. The React UI may hide unavailable actions, but the server must enforce authorization.

### How would the data layer change?

An EF Core implementation would typically receive a scoped `DbContext`, query with LINQ, call asynchronous database methods, and save through `SaveChangesAsync`. Migrations version the schema. For read-heavy endpoints, projection into response DTOs avoids loading unnecessary columns or exposing persistence entities.

### How would I test it?

- Unit-test domain services where rules can be isolated.
- Integration-test the API through an in-memory test server and real HTTP requests.
- Test data access against the actual database engine when database behavior matters.
- Use React Testing Library to exercise the component through visible behavior rather than internal state.
- Keep a small end-to-end suite for critical flows across browser and server.

## Interview questions I would expect

<div class="stack-interview-grid">
  <details><summary>What is dependency injection buying us?</summary><p>Construction is centralized, dependencies are explicit, lifetimes are managed, and implementations can be replaced for testing or infrastructure changes.</p></details>
  <details><summary>Why not return the database entity directly?</summary><p>DTOs keep the public contract independent, prevent accidental over-posting or data exposure, and let storage evolve without breaking clients.</p></details>
  <details><summary>What causes a React component to render?</summary><p>Its state changes, its parent renders with new props, or consumed context changes. Rendering calculates UI; Effects run afterward to synchronize externally.</p></details>
  <details><summary>Why is a React state update sometimes functional?</summary><p>When new state depends on previous state, the updater function receives the latest queued value and avoids stale closures.</p></details>
  <details><summary>Scoped versus singleton?</summary><p>A scoped service is created once per request; a singleton is shared for the application lifetime. Shared mutable singleton state requires careful concurrency design.</p></details>
  <details><summary>Middleware versus an endpoint filter?</summary><p>Middleware wraps the broad HTTP pipeline. Endpoint filters wrap selected endpoint handlers and have access to their arguments and result.</p></details>
</div>

## A useful practice sequence

1. Run the API and call both endpoints with `curl` or an API client before opening React.
2. Add a completion endpoint using `PUT` or `PATCH` and return `404 Not Found` for unknown IDs.
3. Replace the in-memory repository with EF Core and a local database.
4. Add server validation and display field-specific errors in React.
5. Write one API integration test and one component test.
6. Add authentication and require ownership before modifying a task.
7. Explain the request trace without looking at the code.

That final exercise is the real interview preparation. Syntax is searchable. A strong engineer can explain ownership, boundaries, lifetimes, failure modes, and how one user action moves through the system.

## Official references

- [ASP.NET Core minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/overview?view=aspnetcore-10.0)
- [Dependency injection in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-10.0)
- [CORS in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0)
- [React: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [React: Updating arrays in state](https://react.dev/learn/updating-arrays-in-state)
