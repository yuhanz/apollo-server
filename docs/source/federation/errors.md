---
title: Understanding errors
description: Rules for schema composition
---
Schema validation of a federated graph checks to make sure that the schema is a valid GraphQL schema **and** that the gateway has all of the information it needs to peform requests. When building a gateway using the `@apollo/gateway` package, the `gateway.load()` call will throw any validation errors found describing the service(s) that are configured wrong and what the problem is preventing startup. A complete list of the supported validation errors can be found below in the composition errors glossary.

## Glossary of composition errors

### `@key` directives

- `KEY_FIELDS_SELECT_INVALID_TYPE`: The fields argument can not have root fields that result in a list, interface, or union type
- `KEY_FIELDS_MISSING_ON_BASE`: the fields argument can not select fields that were overwritten by another service.
- `KEY_FIELDS_MISSING_EXTERNAL`: On extended types, keys must reference a field marked as `@external`

### `@external` directives

- `EXTERNAL_UNUSED`: For every `@external` field, there should be at least one `@requires`, `@provides`, or `@key` directive that references it
- `EXTERNAL_TYPE_MISMATCH`: All fields marked with `@external` must match the type definition of the base service
- `EXTERNAL_MISSING_ON_BASE`: All fields marked with `@external` must exist on the base type
- `EXTERNAL_USED_ON_BASE`: There should be no fields with `@external` on base type definitions

### `@provides` directives

- `PROVIDES_FIELDS_MISSING_EXTERNAL`: The fields argument can only use fields marked as `@external` on types from external services. These external types and fields must be included in the service for validation
- `PROVIDES_NOT_ON_ENTITY`: Provides directive can only be used on fields that return a type that has a `@key`.
- `PROVIDES_FIELDS_SELECT_INVALID_TYPE`: The fields argument can not reference fields that result in a list or interface

### `@requires` directives

- `REQUIRES_FIELDS_MISSING_EXTERNAL`: For every field in a `@requires` selection, there should be a matching `@external` field in the service.
- `REQUIRES_FIELDS_MISSING_ON_BASE`: The fields arg in `@requires` can only reference fields on the base type
- `REQUIRES_USED_ON_BASE`: There should be no fields with `@requires` on base type definitions

### Root Fields

- `RESERVED_FIELD_USED`: The `Query._service` and `Query._entities` fields should be reserved
- `ROOT_QUERY_USED`: `Query` is disallowed when a schema definition or extension is provided
- `ROOT_MUTATION_USED`: `Mutation` is disallowed when a schema definition or extension is provided
- `ROOT_SUBSCRIPTION_USED`: `Subscription` is disallowed when a schema definition or extension is provided
