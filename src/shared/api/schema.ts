/**
 * SDL мок-сервера. Подмножество полного контракта из docs/graphql-schema.md —
 * здесь только то, что уже реализовано резолверами. Домены добавляются по одному,
 * по мере переезда соответствующего стора с localStorage на GraphQL.
 *
 * Реализовано: Workspace, Problem.
 * Ждёт бэкенда: auth, Profile, Pack/Section/Topic, Application, Experience,
 *               Interview, CalendarEvent, SpaceNode, Board, CustomPage.
 *
 * Живёт в TS, а не в .graphql-файле, чтобы схема попадала в бандл: route handler
 * не может читать её с диска в standalone/Docker-сборке.
 */
export const typeDefs = /* GraphQL */ `
  scalar DateTime

  enum Difficulty {
    EASY
    MEDIUM
    HARD
  }

  enum ProblemStatus {
    TODO
    HINT
    SOLVED
  }

  enum Pattern {
    ARRAY
    HASH_MAP
    TWO_POINTERS
    SLIDING_WINDOW
    BINARY_SEARCH
    STACK
    QUEUE
    LINKED_LIST
    TREE
    BFS
    DFS
    GRAPH
    BACKTRACKING
    DP
    GREEDY
    HEAP
    SORTING
    BIT_OPS
    TRIE
    MATH
  }

  type Workspace {
    id: ID!
    name: String!
  }

  type Problem {
    id: ID!
    title: String!
    url: String
    difficulty: Difficulty!
    status: ProblemStatus!
    patterns: [Pattern!]!
    note: String
    createdAt: DateTime!
  }

  input ProblemInput {
    title: String!
    url: String
    difficulty: Difficulty!
    status: ProblemStatus!
    patterns: [Pattern!]!
    note: String
  }

  type Query {
    workspaces: [Workspace!]!
    problems(workspaceId: ID!): [Problem!]!
  }

  type Mutation {
    createProblem(workspaceId: ID!, input: ProblemInput!): Problem!
    updateProblem(workspaceId: ID!, id: ID!, input: ProblemInput!): Problem!
    cycleProblemStatus(workspaceId: ID!, id: ID!): Problem!
    deleteProblem(workspaceId: ID!, id: ID!): Boolean!
  }

  type Subscription {
    """
    Пушится при любом изменении задач в воркспейсе — в т.ч. из другой вкладки.
    Транспорт: SSE, т.к. Next route handler не умеет WebSocket-upgrade.
    """
    problemsChanged(workspaceId: ID!): [Problem!]!
  }
`;
