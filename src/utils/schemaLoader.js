const schemaModules = import.meta.glob('../assets/logistics-objects/*.json', {
  eager: true,
  import: 'default'
});

const schemasByFilename = Object.fromEntries(
  Object.entries(schemaModules).map(([path, schema]) => [path.split('/').pop(), schema])
);

export const getSchema = (filename) => {
  const schema = schemasByFilename[filename];
  if (!schema) {
    throw new Error(`Unknown logistics object schema: ${filename}`);
  }
  return schema;
};

export const listSchemas = () => Object.entries(schemasByFilename);
