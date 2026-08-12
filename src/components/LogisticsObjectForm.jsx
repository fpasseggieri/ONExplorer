import React, { useState, useEffect, memo } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Stack,
  Tooltip,
  Divider,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { getSchema } from '../utils/schemaLoader';
import { getLogisticsObjects } from '../utils/api';

const FieldLabel = ({ name, description }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <Typography variant="subtitle1" fontWeight="500">
      {name}
    </Typography>
    {description && (
      <Tooltip title={description} arrow placement="right">
        <InfoIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} />
      </Tooltip>
    )}
  </Stack>
);

const generateFormFields = async (columns) => {
  const fields = [];
  const basicTypes = ['string', 'boolean', 'integer', 'double', 'datetime'];

  for (const column of columns) {
    const field = {
      name: column.name,
      label: column.name || column.description,
      type: column.type,
      schemaType: column.schemaType,
      array: column.array,
      required: false,
      description: column.description,
      valueIRI: column.valueIRI,
      codelist: column.codelist
    };

    switch(column.schemaType) {
      case 'Embedded':
        field.dataType = 'fieldset';
        try {
          const embeddedSchema = getSchema(`Embedded.${column.type}.json`);
          field.fields = await generateFormFields(embeddedSchema.columns);
        } catch (error) {
          console.error(`Error loading embedded schema for ${column.type}:`, error);
        }
        break;
        
      case 'Enum':
        field.dataType = 'url';
        field.type = 'select';
        field.options = []; // Load options from codelist if available
        break;
        
      default:
        // Handle basic types and URLs
        if (basicTypes.includes(column.type.toLowerCase())) {
          switch (column.type.toLowerCase()) {
            case 'boolean':
              field.dataType = 'boolean';
              break;
            case 'integer':
              field.dataType = 'integer';
              break;
            case 'double':
              field.dataType = 'double';
              break;
            case 'datetime':
              field.dataType = 'datetime';
              break;
            default:
              field.dataType = 'text';
          }
        } else {
          // It's a URL reference to another object
          field.dataType = 'url';
          field.referenceType = column.type;
        }
    }

    fields.push(field);
  }

  return fields;
};

const createTypedValue = (val = '', dataType) => {
  switch(dataType) {
    case 'url':
      return { '@id': val };
    case 'boolean':
      return {
        '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
        '@value': String(val === 'true' || val === true)
      };
    case 'integer':
      return {
        '@type': 'http://www.w3.org/2001/XMLSchema#integer',
        '@value': String(val)
      };
    case 'double':
      return {
        '@type': 'http://www.w3.org/2001/XMLSchema#double',
        '@value': String(val)
      };
    case 'datetime':
      return {
        '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
        '@value': String(val)
      };
    default:
      return val;
  }
};

const extractValue = (typedValue, dataType) => {
  if (!typedValue) return '';
  switch(dataType) {
    case 'url':
      return typedValue['@id'] || '';
    case 'boolean':
    case 'integer':
    case 'double':
    case 'datetime':
      return typedValue['@value'] || '';
    default:
      return typedValue;
  }
};

const FormField = memo(({ field, value, onChange }) => {
  const [referenceOptions, setReferenceOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [useDirectInput, setUseDirectInput] = useState(false);

  useEffect(() => {
    if (field.dataType === 'url' && value) {
      const valueExists = referenceOptions.some(option => option['@id'] === value);
      
      if (!valueExists && !loading) {
        setUseDirectInput(true);
      }
    }
  }, [value, referenceOptions, loading, field.dataType]);

  useEffect(() => {
    const loadReferenceOptions = async () => {
      if (!dropdownOpen || field.dataType !== 'url') return;
      setLoading(true);
      try {
        if (field.codelist) {
          const codelistName = field.valueIRI.split('#')[1];
          const codelists = await import('../assets/codelists/codelists.json');
          const codelistValues = (codelists.default[codelistName] || []).map(item => ({
            '@id': item.id,
            '@type': field.valueIRI,
            description: item.description,
            id: item.id
          }));
          setReferenceOptions(codelistValues);

          if (value && !codelistValues.some(option => option['@id'] === value)) {
            setUseDirectInput(true);
          }
        } else {
          const type = encodeURIComponent(field.valueIRI);
          const response = await getLogisticsObjects(type);

          const objects = (response['@graph'] || [response])
            .filter(obj => obj && Object.keys(obj).length > 0);
          setReferenceOptions(objects);

          if (value && !objects.some(option => option['@id'] === value)) {
            setUseDirectInput(true);
          }
        }
      } catch (error) {
        console.error(`Error loading options for ${field.name}:`, error);
        setReferenceOptions([]);
        if (value) {
          setUseDirectInput(true);
        }
      } finally {
        setLoading(false);
      }
    };

    if (dropdownOpen) {
      loadReferenceOptions();
    }
  }, [dropdownOpen, field.dataType, field.codelist, field.valueIRI, field.name, value]);

  const commonProps = {
    fullWidth: true,
    value: value || '',
    onChange: (e) => onChange(e.target.value),
    size: "medium"
  };

  if (field.dataType === 'url' && !field.array) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <FieldLabel name={field.name} description={field.description} />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={useDirectInput}
                onChange={(e) => setUseDirectInput(e.target.checked)}
              />
            }
            label="Direct URL Input"
          />
        </Box>
        
        {useDirectInput ? (
          <TextField
            {...commonProps}
            type="url"
            placeholder="Enter URL"
            variant="outlined"
            fullWidth
          />
        ) : (
          <FormControl fullWidth>
            <Select
              {...commonProps}
              displayEmpty
              disabled={loading}
              onOpen={() => setDropdownOpen(true)}
              onClose={() => setDropdownOpen(false)}
            >
              <MenuItem value="">
                <em>Select {field.type}</em>
              </MenuItem>
              {loading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} /> Loading...
                </MenuItem>
              ) : referenceOptions.length === 0 ? (
                <MenuItem disabled>No options available</MenuItem>
              ) : (
                referenceOptions.map((option) => (
                  <MenuItem key={option['@id']} value={option['@id']}>
                    {option.name || option.description || option['@id']}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        )}
      </Paper>
    );
  }

  if (field.array) {
    // Ensure value is always an array
    const arrayValue = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <Box sx={{ mb: 3 }}>
        <FieldLabel name={field.name} description={field.description} />
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              {arrayValue.map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box flex={1}>
                    <FormField
                      field={{ ...field, array: false }}
                      value={extractValue(item, field.dataType)}
                      onChange={(newValue) => {
                        const newArray = [...arrayValue];
                        newArray[index] = createTypedValue(newValue, field.dataType);
                        onChange(newArray);
                      }}
                    />
                  </Box>
                  <IconButton 
                    onClick={() => {
                      const newArray = [...arrayValue];
                      newArray.splice(index, 1);
                      onChange(newArray);
                    }}
                    color="error"
                  >
                    <RemoveIcon />
                  </IconButton>
                </Box>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={() => onChange([...arrayValue, createTypedValue('', field.dataType)])}
                variant="outlined"
                size="small"
              >
                Add Item
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (field.dataType === 'fieldset' && !field.array) {
    return (
      <Paper sx={{ p: 3, mb: 2 }}>
        <FieldLabel name={field.name} description={field.description} />
        <Divider sx={{ my: 2 }} />
        <Stack spacing={2}>
          {field.fields.map(subField => (
            <FormField
              key={subField.name}
              field={subField}
              value={
                (() => {
                  switch(subField.dataType) {
                    case 'url':
                      return value?.[subField.name]?.['@id'] || '';
                    case 'boolean':
                      return value?.[subField.name]?.['@value'] === 'true';
                    case 'integer':
                      return parseInt(value?.[subField.name]?.['@value'] || '0', 10);
                    case 'double':
                      return parseFloat(value?.[subField.name]?.['@value'] || '0');
                    case 'datetime':
                      return value?.[subField.name]?.['@value'] || '';
                    default:
                      return value?.[subField.name];
                  }
                })()
              }
              onChange={(newValue) => {
                let processedValue;
                switch(subField.dataType) {
                  case 'url':
                    processedValue = {
                      '@id': newValue
                    };
                    break;
                  case 'boolean':
                    processedValue = {
                      '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
                      '@value': String(newValue === 'true' || newValue === true)
                    };
                    break;
                  case 'integer':
                    processedValue = {
                      '@type': 'http://www.w3.org/2001/XMLSchema#integer',
                      '@value': String(parseInt(newValue, 10))
                    };
                    break;
                  case 'double':
                    processedValue = {
                      '@type': 'http://www.w3.org/2001/XMLSchema#double',
                      '@value': String(parseFloat(newValue))
                    };
                    break;
                  case 'datetime':
                    processedValue = {
                      '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                      '@value': String(newValue)
                    };
                    break;
                  default:
                    processedValue = newValue;
                }

                const fieldsetValue = {
                  ...value,
                  '@type': field.valueIRI,
                  [subField.name]: processedValue
                };
                onChange(fieldsetValue);
              }}
            />
          ))}
        </Stack>
      </Paper>
    );
  }

  if (field.dataType === 'boolean') {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={value === true || value === 'true'}
              onChange={(e) => onChange(e.target.checked)}
              size="medium"
            />
          }
          label={<FieldLabel name={field.name} description={field.description} />}
        />
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <FieldLabel name={field.name} description={field.description} />
      <TextField
        {...commonProps}
        type={(field.type === 'double' || field.type === 'integer') ? 'number' : field.dataType || 'text'}
        inputProps={{
          ...(field.type === 'double' && { step: 'any' }),
          ...(field.type === 'integer' && { step: '1' })
        }}
        variant="outlined"
        helperText={field.description}
        sx={{ mt: 1 }}
      />
    </Paper>
  );
});

const LogisticsObjectForm = ({ objectType, initialData, onSubmit, debounceMs = 500 }) => {
  const [formData, setFormData] = useState(initialData || {});
  const [formStructure, setFormStructure] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load form structure
  useEffect(() => {
    const loadFormStructure = async () => {
      try {
        if (objectType.fullSchema) {
          const fields = await generateFormFields(objectType.fullSchema.columns);
          setFormStructure(fields);
        } else {
          const schema = getSchema(`${objectType.schema}.${objectType.name}.json`);
          const fields = await generateFormFields(schema.columns);
          setFormStructure(fields);
        }
      } catch (error) {
        console.error('Error loading schema:', error);
      } finally {
        setLoading(false);
      }
    };

    if (objectType) {
      loadFormStructure();
    }
  }, [objectType]);

  // Push form data to the parent immediately or with a debounce, depending on caller needs.
  useEffect(() => {
    if (debounceMs === 0) {
      onSubmit(formData);
      return undefined;
    }

    const timer = setTimeout(() => {
      onSubmit(formData);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debounceMs, formData, onSubmit]);

  const handleFieldChange = (fieldName, value, fieldDataType, fieldType) => {
    // If it's an array, return the value directly as it's already processed
    if (Array.isArray(value)) {
      setFormData(prevData => ({ 
        ...prevData, 
        [fieldName]: value
      }));
      return;
    }

    let newValue;
    switch(fieldDataType) {
      case 'url':
        if (fieldType !== 'fieldset') {
          newValue = {
            '@id': value
          };
        } else {
          newValue = value;
        }
        break;
        
      case 'boolean':
        newValue = {
          '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
          '@value': String(value === 'true' || value === true)
        };
        break;
        
      case 'integer':
        newValue = {
          '@type': 'http://www.w3.org/2001/XMLSchema#double',
          '@value': String(parseInt(value, 10))
        };
        break;

      case 'double':
        newValue = {
          '@type': 'http://www.w3.org/2001/XMLSchema#double',
          '@value': String(parseFloat(value))
        };
        break;
        
      case 'datetime':
        newValue = {
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          '@value': String(value)
        };
        break;
        
      default:
        newValue = value;
    }

    setFormData(prevData => ({ 
      ...prevData, 
      [fieldName]: newValue
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="div">
      <Stack spacing={3}>
        {formStructure?.map(field => (
          <FormField
            key={field.name}
            field={field}
            value={
              (() => {
                if (field.array) {
                  return formData[field.name];
                }
                
                switch(field.dataType) {
                  case 'url':
                    return formData[field.name]?.['@id'] || '';
                  case 'boolean':
                    return formData[field.name]?.['@value'] === 'true';
                  case 'integer':
                    return parseInt(formData[field.name]?.['@value'] || '0', 10);
                  case 'double':
                    return parseFloat(formData[field.name]?.['@value'] || '0');
                  case 'datetime':
                    return formData[field.name]?.['@value'] || '';
                  default:
                    return formData[field.name];
                }
              })()
            }
            onChange={(value) => handleFieldChange(field.name, value, field.dataType, field.type)}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default LogisticsObjectForm; 
