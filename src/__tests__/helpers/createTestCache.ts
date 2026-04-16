import { InMemoryCache, gql } from "@apollo/client";

export function createTestCache(): InMemoryCache {
  return new InMemoryCache();
}

export function createPopulatedCache(): InMemoryCache {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: gql`
      query {
        hello
      }
    `,
    data: { hello: "world" },
  });
  return cache;
}

export const SAMPLE_QUERY = gql`
  query GetUser {
    user {
      id
      name
      email
    }
  }
`;

export const SAMPLE_DATA = {
  user: {
    __typename: "User",
    id: "1",
    name: "Alice",
    email: "alice@example.com",
  },
};

export const NESTED_QUERY = gql`
  query GetUserWithPosts {
    user {
      id
      name
      posts {
        id
        title
        comments {
          id
          body
        }
      }
    }
  }
`;

export const NESTED_DATA = {
  user: {
    __typename: "User",
    id: "1",
    name: "Alice",
    posts: [
      {
        __typename: "Post",
        id: "p1",
        title: "First Post",
        comments: [
          { __typename: "Comment", id: "c1", body: "Great!" },
          { __typename: "Comment", id: "c2", body: "Nice work" },
        ],
      },
      {
        __typename: "Post",
        id: "p2",
        title: "Second Post",
        comments: [],
      },
    ],
  },
};
