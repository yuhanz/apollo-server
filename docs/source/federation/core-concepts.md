---
title: Core concepts
description: How schema composition works
---
## What is an entity?
Apollo federation works through a declarative composition model where services expose their capabilities and together they can be formed into a single graph. The very base of this progamming model is the idea of an *entity*. An entity is a type that can be both referenced and extended by another service. They create connection points between services and form the basic building blocks of a federated graph. Take an accounts service as an example:

```graphql
type User {
  id: ID!
  username: String
}
```

Converting this type into an entity is done by adding an `@key` directive to the type:

```graphql{1}
type User @key(fields: "id") {
  id: ID!
  username: String
}
```

The purpose of the additional metadata provided by the `@key` directive is to communicate to the gateway that the `User` type is now an entity that other services can use. The directive takes one argument describing which fields on the type make up its key. Much like a primary key in a database, this directive tells the query planner that a `User` can be fetched if you have its `id`.


## Connect types together

Once an entity is part of the graph, other services can begin to reference that type from its own types. Let's look at how the reviews service can join across services to return a `User`:

```graphql
type Review {
  author: User
}

extend type User @key(fields: "id") {
  id: ID! @external
}
```

A couple things are happening here that let the reviews service return a `User` from the accounts service:

```graphql{2}
type Review {
  author: User
}
```

First, the reviews service defines its own type `Review`. This type has a field called `author` which returns the `User` type. Since the reviews service doesn't have any concept of a `User`, we need to define a version of that type that this service understands:

```graphql
extend type User @key(fields: "id") {
  id: ID! @external
}
```

Here the reviews service duplciates the `User` type with two additional points of metadata. The `@key` directive is added to the `User` type to tell the query planner that the reviews service will return at least the `id` field when returning a `User` type. The `@external` directive is used to validate the type information of `User.id` from the reviews service against the accounts service. It also allows services to be complete schemas that can be run on their own without missing types.

The resolvers for fields that return external types need to return an object that contains the typename and the specified key fields of the target:

```js
{
  Review: {
    author(review) {
      return { __typename: "User", id: review.authorID };
    }
  }
}
```

The gateway will then use the results of these resolvers as input to a fetch on the services hosting the referenced types. In order to allow the gateway to enter the graph on those services, you'll want to define reference resolvers on the accounts services to centralize fetching for their respective types:

```js{3-5}
{
  User: {
    __resolveReference(reference) {
      return fetchUserByID(reference.id);
    }
  }
}
```

Reference resolvers are a special addition to Apollo Server that allow individual types to be resolved by a reference from another service. They are only called when a query references an `entity` across service boundaries. To learn more about `__resolveReference`, see the [API docs](/api/apollo-federation/)

What is interesting about this model is that we end up with a schema that represents a true subset of the overall graph, as opposed to a mangled schema with foreign key fields like `authorID`. Ultimately, this means clients can write queries like this:

```graphql
{
  reivews {
    author {
      username
    }
  }
}
```
without having to ask for special fields or make additional requests to other serivces.

## Extend types

Returning a reference to an author represents just one side of a relationship. A true data graph should expose the ability to navigate relationships in both directions. You'll want to be able to go from a user to the reviews they authored for example. While these fields are exposed on `User` for client to query, they shouldn't be part of the accounts service because they are a concern of the reviews service.

That isn't just a conceptual point: the user service won't know how to resolve a query for `reviews`, because data about reviews is stored in the reviews system (as a reviews table with foreign key references to users for example).

Fortunately, GraphQL includes a mechanism for type extension that works well for this use case. While the `User` type belongs to the accounts services, other services can define extension fields on this type using the `extend type` syntax.

The query planner will make sure the fields required by a resolver on an extension field are requested from the service hosting the type even if the user didn't request them directly. Every resolver that is added to a type from another service will receive the fields requested in the `@key` directive on the type extension.

For example, if we wanted to add a reviews field to the `User` type:

```graphql{3}
extend type User @key(fields: "id") {
  id: ID! @external
  reviews: [Review]
}
```

Since the reviews service already had a concept of the `User` type from returning it, adding additional fields to the overall type can be done just like it was a normal type.

The generated query plan will fetch the `id` field for each `User` from the accounts service and pass those to the reviews service, where you can then access these fields on the object passed into your `reviews` resolver:

```js
{
  User: {
    reviews(user) {
      return fetchReviewsForUser(user.id);
    }
  }
}
```

Type extensions aren't just useful for relationships however. You can also use them to extend types with additional scalar or other value fields. Here, we want to be able to query for the `inStock` status of a product. That information lives in an inventory service, so we'll add the type extension there:

```graphql{3}
extend type Product @key(fields: "sku") {
  sku: ID! @external
  inStock: Boolean
}
```

```js
{
  Product: {
    inStock(product): {
      return fetchInStockStatusForProductWithSKU(product.sku);
    }
  }
}
```

Similar to the `reviews` relationship example above, the gateway will fetch the required `sku` field from the product service and pass it to the inventory service, even if the query didn't ask for the `sku`:

```graphql
query {
  topProducts {
    inStock
  }
}
```

## Primary keys

### What is a primary key?

One of the core aspects that makes Apollo Federation work is that entities are uniquely indentifiable. In fact, this is not a new idea to GraphQL. The Node interface from [the Relay spec](https://facebook.github.io/relay/docs/en/graphql-server-specification.html#object-identification) is one way to reference an entity that requires a singular global `id`. In our experience working with teams running GraphQL in production, it became clear that a singular `id` isn't always a practical way to reference an entity. With Apollo Federation, we can reference types with multiple primary keys or compound keys by adding a @key directive. Keys are defined with the `@key` directive, passing in the fields that make up the primary key for that entity:

```graphql
type Product @key(fields: "sku") {
  sku: ID!
  name: String
  price: String
}
```

### Advanced customization

There may be multiple ways of referring to the same type however, as when we refer to a user either by ID or email. This is especially common when an types span services: your review system may refer to a product by UPC, while your inventory system stores SKUs.

Therefore, the programming model allows types to define multiple keys, which indicates they can be looked up in one of several ways:

```graphql
type Product @key(fields: "upc") @key(fields: "sku") {
  upc: String!
  sku: String!
  price: String
}
```

> Note that this is different from `@key(fields: "upc sku")`, a composite key, which would mean that only the combination of UPC and SKU is unique.

Multiple keys are only allowed on the base type however, not on type extensions. Type extensions are used to define external types, so a `@key` directive there is meant to specify which key of the base type will be used as a foreign key by the service that contains the type extension. For example, our reviews service could use `upc`:

```graphql
extend type Product @key(fields: "upc") {
  upc: String! @external
  reviews: [Review]
}
```

While the inventory service uses `sku`:

```graphql
extend type Product @key(fields: "sku") {
  sku: ID! @external
  inStock: Boolean
}
```

In some cases, keys may be complex and include nested fields, as when a user's ID is only unique within its organization:

```graphql
type User @key(fields: "id organization { id }") {
  id: ID!
  organization: Organization!
}

type Organization {
  id: ID!
}
```

> Note that although the fields argument is parsed as a selection set, some restrictions apply to make the result suitable as a key. For example, fields shouldn't return lists.

## Computed fields

In many cases, what you need to resolve an extension field is a foreign key, which you specify through the `@key` directive on the type extension. With the `@requires` directive however, you can require any additional combination of fields (including subfields) from the base type that you may need in your resolver. For example, you may need access to a product's size and weight to calculate a shipping estimate:

```graphql{5}
extend type Product @key(fields: "sku") {
  sku: ID! @external
  size: Int @external
  weight: Int @external
  shippingEstimate: String @requires(fields: "size weight")
}
```

If a client requests `shippingEstimate`, the query planner will now request `size` and `weight` from the base `Product` type, and pass it through to your service, so you can access them directly from your resolver in the exact same way you would if `Product` was contained within a single service:

```js{4}
{
  Product: {
    shippingEstimate(product): {
      return computeShippingEstimate(product.size, product.weight);
    }
  }
}
```

> Note that you can only require fields that live on the original type definition, not on type extensions defined in other services.

## Shortcuts for faster fetching

In some cases, a service will be able to provide additional fields, even if these are not part of a key. For example, our review system may store the user's name in addition to the id, so we don't have to perform a separate fetch to the accounts service to get it. We can indicate which additional fields can be queried on the referenced type using the `@provides` directive:

```graphql{2,7}
type Review {
  author: User @provides(fields: "username")
}

type User @key(fields: "id") {
  id: ID! @external
  username: String @external
}
```

The `@provides` directive acts as a hint to the gateway

```js{4}
{
  Review: {
    author(review) {
      return { id: review.authorID, username: review.authorUsername };
    }
  }
}
```

This knowledge can be used by the gateway to generate a more efficient query plan and avoids a fetch to a separate service because a field is already provided. In this case, we can return the author's name as part of the fetch to the reviews service:

```graphql
query {
  topReviews {
    author {
      username
    }
  }
}
```

