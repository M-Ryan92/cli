/* eslint-disable no-param-reassign */
import {
  createNodeArray,
  createObjectLiteral,
  createPropertyAssignment,
  createStatement,
  createStringLiteral,
  isFunctionDeclaration,
  isSourceFile,
  ExpressionStatement,
  Node,
  NodeArray,
  ParameterDeclaration,
  PropertyAssignment,
  SourceFile,
  StringLiteral,
  Transformer,
  TransformerFactory,
  transpileModule,
  TypeNode,
  visitNode,
} from 'typescript';

export enum Compatibility {
  Boolean = 'Boolean',
  Number = 'Number',
  String = 'String',
}

// TODO: Add support
export enum CompatibilityToDo {
  Color = 'Color',
  Endpoint = 'Endpoint',
  Filter = 'Filter',
  Font = 'Font',
  Properties = 'Properties',
  Property = 'Property',
  Size = 'Size',
  Unit = 'Unit',
}

const compatibilityValues: Compatibility[] = [
  Compatibility.Boolean,
  Compatibility.Number,
  Compatibility.String,
];

const isCompatibility = (value: unknown): value is Compatibility =>
  typeof value === 'string' &&
  compatibilityValues.includes(value as Compatibility);

const isParameters = (value: unknown): boolean => {
  if (typeof value === 'object' && value !== null) {
    const names = Object.keys(value);
    const types = Object.values(value);

    return (
      names.every((name: unknown): boolean => typeof name === 'string') &&
      types.every(isCompatibility)
    );
  }

  return false;
};

export interface Interaction {
  name: string;
  parameters: Record<string, Compatibility>;
  type: Compatibility;
}

const isInteraction = (value: unknown): value is Interaction => {
  if (typeof value === 'object' && value !== null) {
    const { name, parameters, type } = value as Interaction;

    return (
      typeof name === 'string' &&
      isParameters(parameters) &&
      isCompatibility(type)
    );
  }

  return false;
};

const compatibilityLiteral = (node: TypeNode): StringLiteral => {
  const text = node.getText();

  switch (text) {
    case 'boolean': {
      return createStringLiteral(Compatibility.Boolean);
    }
    case 'number': {
      return createStringLiteral(Compatibility.Number);
    }
    case 'string': {
      return createStringLiteral(Compatibility.String);
    }
    default: {
      throw new TypeError(`unsupported type: ${text}`);
    }
  }
};

const createParameter = ({
  name,
  type,
}: ParameterDeclaration): PropertyAssignment => {
  const text = name.getText();

  if (typeof type === 'undefined') {
    throw new TypeError(`type of parameter ${text} is undefined`);
  }

  return createPropertyAssignment(
    createStringLiteral(text),
    compatibilityLiteral(type),
  );
};

const generateCompatibility = (
  name: string,
  type: TypeNode,
  parameters: NodeArray<ParameterDeclaration>,
): NodeArray<ExpressionStatement> =>
  createNodeArray([
    createStatement(
      createObjectLiteral([
        createPropertyAssignment(
          createStringLiteral('name'),
          createStringLiteral(name),
        ),
        createPropertyAssignment(
          createStringLiteral('parameters'),
          createObjectLiteral(parameters.map(createParameter)),
        ),
        createPropertyAssignment(
          createStringLiteral('type'),
          compatibilityLiteral(type),
        ),
      ]),
    ),
  ]);

const compatibilityTransformer = (): TransformerFactory<
  SourceFile
> => (): Transformer<SourceFile> => (sourceFile: SourceFile): SourceFile =>
  visitNode(
    sourceFile,
    (node: Node): Node => {
      if (isSourceFile(node)) {
        const { statements } = node;
        const { length } = statements;

        if (length === 0) {
          throw new RangeError('file does not contain an interaction');
        }

        if (length > 1) {
          throw new RangeError('file contains multiple statements');
        }

        const [statement] = statements;

        if (isFunctionDeclaration(statement)) {
          const { parameters, type, name: nameNode } = statement;

          if (typeof nameNode === 'undefined') {
            throw new TypeError(`function name indentifier is not defined`);
          }

          const name = nameNode.getText();

          if (typeof type === 'undefined') {
            throw new TypeError(`return type of ${name} is undefined`);
          }

          node.statements = generateCompatibility(name, type, parameters);

          return node;
        }
      }

      throw new TypeError(`
expected expression of the kind
  function interaction(...args: ArgumentType[]): ReturnType {
    // body
  }
`);
    },
  );

export default (code: string): Interaction => {
  const { outputText } = transpileModule(code, {
    transformers: { before: [compatibilityTransformer()] },
  });

  const { length } = outputText;
  const interaction = JSON.parse(outputText.slice(1, length - 3));

  if (isInteraction(interaction)) {
    return interaction;
  }

  throw new TypeError('object is not an Interaction');
};
