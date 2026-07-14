
## 1. Аутентификация (JWT)


```graphql
type User {
  id: ID!
  email: String!
  createdAt: DateTime!
}

type AuthPayload {
  accessToken: String!    
  user: User!
}

type Query {
  me: User                # null, если не авторизован
}

type Mutation {
  register(email: String!, password: String!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
  refresh: AuthPayload!  
  logout: Boolean!      
}
```

---

## 2. Воркспейсы

Корень всей модели данных: `User 1—N Workspace 1—N <всё остальное>`. У пользователя
несколько воркспейсов («Personal» по умолчанию), и данные между ними изолированы
полностью: своё дерево файлов, своя доска. Поэтому почти каждый запрос и каждая мутация
в этой схеме принимают `workspaceId`.


```graphql
type Workspace {
  id: ID!
  name: String!
  createdAt: DateTime!
}

extend type Query {
  workspaces: [Workspace!]!          # только свои, по токену
}

extend type Mutation {
  createWorkspace(name: String!): Workspace! 
  renameWorkspace(id: ID!, name: String!): Workspace!
  deleteWorkspace(id: ID!): Boolean! # каскадом удаляет дерево файлов и все доски
}
```

`id: "personal"` - дефолтный воркспейс, создаётся при первом запросе воркспейсов

---

## 3. Space — дерево файлов и markdown

Дерево нормализуем, а контент
файла - просто строка, отдаём отдельным запросом, чтобы не тянуть все тексты вместе
со списком.

```graphql
enum SpaceNodeType {
  FILE
  FOLDER
}

type SpaceNode {
  id: ID!
  name: String!
  type: SpaceNodeType!
  parentId: ID # null = корень
  createdAt: DateTime!
}

type SpaceFile {
  id: ID!
  content: String! # markdown
  updatedAt: DateTime!
}

extend type Query {
  spaceTree(workspaceId: ID!): [SpaceNode!]! 
  spaceFile(workspaceId: ID!, id: ID!): SpaceFile
}

extend type Mutation {
  createSpaceNode(
    workspaceId: ID!
    name: String!
    type: SpaceNodeType!
    parentId: ID
  ): SpaceNode!
  renameSpaceNode(workspaceId: ID!, id: ID!, name: String!): SpaceNode!
  moveSpaceNode(workspaceId: ID!, id: ID!, parentId: ID): SpaceNode!
  deleteSpaceNode(workspaceId: ID!, id: ID!): Boolean! # каскад по всем потомкам
  saveSpaceFile(workspaceId: ID!, id: ID!, content: String!): SpaceFile!
}
```

---

## 4. Доски

В воркспейсе может быть **несколько досок**. При создании воркспейса сервер сам заводит
первую — `Board_1`, чтобы пользователю никогда не открывался пустой экран без единой доски.


```graphql
type Board {
  id: ID!
  workspaceId: ID!
  name: String!
  data: JSON! # { nodes: BNode[], edges: BEdge[] }
  version: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

extend type Query {
  boards(workspaceId: ID!): [Board!]! # без data — для списка/переключателя досок
  board(workspaceId: ID!, id: ID!): Board
}

extend type Mutation {
  createBoard(workspaceId: ID!, name: String): Board! # name пустой -> Board_N
  renameBoard(workspaceId: ID!, id: ID!, name: String!): Board!
  deleteBoard(workspaceId: ID!, id: ID!): Boolean!

  # version — та, что клиент получил при чтении. Если на сервере уже больше —
  # значит доску изменили параллельно: ошибка CONFLICT, клиент перечитывает.
  saveBoard(workspaceId: ID!, id: ID!, data: JSON!, version: Int!): Board!
}
```


---

## 5. Subscriptions

```graphql
type Subscription {
  # Подписка на конкретную открытую доску, а не на все доски воркспейса:
  boardChanged(workspaceId: ID!, boardId: ID!): Board!

  # Список досок: появилась/переименована/удалена (без data)
  boardsChanged(workspaceId: ID!): [Board!]!

  spaceFileChanged(workspaceId: ID!, fileId: ID!): SpaceFile!
  spaceTreeChanged(workspaceId: ID!): [SpaceNode!]!
}
```

---
