# Todo

A todo list app where a user logs in to see one todo list and move its items between columns. User management is deferred.

## Language

**Todo list**:
The single list of items a user sees after logging in. In this slice there is only one.
_Avoid_: board, list

**Item**:
An entry on the todo list. Its only content is its description, and it sits in exactly one column.
_Avoid_: task, todo, card

**Column**:
One of the three visually distinct sections of the todo list: Todo, Doing, Done. Every item sits in exactly one column.
_Avoid_: status, lane

**Move**:
Changing the column of an item. Any column can be moved to any other column.
_Avoid_: transition, transfer

**Login**:
Entering a username and password to gain access to the todo list.

**User**:
A person who logs in. User management is deferred, so the todo list has no per-user ownership yet.
