import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Box,
  Typography,
  IconButton,
  MenuItem,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Button,
  TablePagination
} from '@mui/material';
import {
  LocalShipping as LocalShippingIcon,
  Inventory as InventoryIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Message as MessageIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getLogisticsObjects } from '../utils/api';
import LogisticsObjectEdit from '../components/LogisticsObjectEdit';
import { validateSettings } from '../utils/settingsValidator';
import SubscriptionDialog from '../components/SubscriptionDialog';
import { getRoleStorageItem, setRoleStorageItem } from '../utils/roleStorage';

// Add this constant at the top of the file, after imports
const TABLE_STYLES = {
  header: {
    variant: "h6",
    sx: { 
      mb: 2, 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1,
      color: '#1976d2',
      fontWeight: 600 
    }
  },
  tableHead: {
    sx: { backgroundColor: '#f5f5f5' }
  },
  tableRow: {
    sx: { 
      '&:hover': { backgroundColor: '#f5f5f5' },
      backgroundColor: 'inherit'
    }
  }
};
const ROWS_PER_PAGE = 25;

const toFirst = (value) => (Array.isArray(value) ? value[0] : value);

const unwrapScalar = (value) => {
  const first = toFirst(value);
  if (first === undefined || first === null) return '';
  if (typeof first === 'object') {
    if (first['@value'] !== undefined) return first['@value'];
    if (first['@id'] !== undefined) return first['@id'];
  }
  return first;
};

const getCreatedAt = (item) => (
  unwrapScalar(item['https://onerecord.iata.org/ns/cargo#creationDate']) ||
  unwrapScalar(item['creationDate']) ||
  unwrapScalar(item.createdAt) ||
  unwrapScalar(item.requestTime) ||
  ''
);

const getUpdatedAt = (item) => (
  unwrapScalar(item.updatedAt) ||
  unwrapScalar(item['updatedAt']) ||
  unwrapScalar(item['https://onerecord.iata.org/ns/api#updatedAt']) ||
  unwrapScalar(item['https://onerecord.iata.org/ns/cargo#updatedAt']) ||
  ''
);

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const cleanupItem = (item) => {
  
  return {
    id: item['@id'].split('/').pop(),
    type: Array.isArray(item['@type']) 
        ? item['@type']
            .filter(t => t !== 'https://onerecord.iata.org/ns/cargo#LogisticsObject')[0]?.split('#').pop() 
        : 'test'|| 'Unknown Type',
    createdAt: getCreatedAt(item),
    updatedAt: getUpdatedAt(item),
    description: item['https://onerecord.iata.org/ns/cargo#description'] || 'No description available',
    // Add any other properties you need to clean up
  };
};

const Database = ({ isAuthenticated = true }) => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [types, setTypes] = useState([]);
  const [searchId, setSearchId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [externalObjects, setExternalObjects] = useState([]);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [selectedObjectForSubscription, setSelectedObjectForSubscription] = useState(null);
  const [settingsValid, setSettingsValid] = useState(false);
  const [page, setPage] = useState(0);
  const [externalPage, setExternalPage] = useState(0);

  useEffect(() => {
    const { isValid } = validateSettings();
    setSettingsValid(isValid);
  }, []);

  useEffect(() => {
    if (settingsValid && isAuthenticated) {
      fetchData();
    } else if (!isAuthenticated) {
      setLoading(false);
    }
  }, [settingsValid, isAuthenticated]);

  useEffect(() => {
    // Load external objects from localStorage on component mount
    const savedExternalObjects = getRoleStorageItem('externalLogisticsObjects');
    if (savedExternalObjects) {
      setExternalObjects(JSON.parse(savedExternalObjects));
    }
  }, []);

  useEffect(() => {
    const uniqueTypes = [...new Set(data.map(item => item.type))];
    setTypes(uniqueTypes);
  }, [data]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await getLogisticsObjects('https%3A%2F%2Fonerecord.iata.org%2Fns%2Fcargo%23LogisticsObject');
      
      // Check if response is an array, if not convert it to an array
      const rawData = response['@graph'] ? response['@graph'] : [response];
      
      // Clean up each item in the array
      const cleanedData = rawData.map(cleanupItem);
      
      setData(cleanedData);
      setFilteredData(cleanedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (event) => {
    setSelectedType(event.target.value);
  };

  const clearFilter = () => {
    setSelectedType('');
  };

  // Action Menu handlers
  const handleView = (item) => {
    if (!isAuthenticated) return;
    navigate(`/logistics-objects/${item.id}`, {
      state: { 
        isExternal: false,
        serverUrl: getRoleStorageItem('baseUrl')
      }
    });
  };

  const handleEdit = (item, isExternal = false) => {
    if (!isAuthenticated) return;
    let serverDetails;
    
    if (isExternal) {
      // Get external server config from localStorage
      const externalServers = JSON.parse(getRoleStorageItem('externalServers') || '[]');
      const serverConfig = externalServers.find(s => s.baseUrl === item.server);
      
      serverDetails = {
        baseUrl: item.server,
        serverId: serverConfig?.id
      };
    } else {
      // Use internal server config
      const baseUrl = getRoleStorageItem('baseUrl');
      serverDetails = {
        baseUrl
      };
    }

    setSelectedItem({
      ...item,
      id: item.id,
      serverDetails
    });
    setEditDialogOpen(true);
  };

  // Add handler for dialog close
  const handleEditClose = () => {
    setEditDialogOpen(false);
    // Optionally refresh the data after edit
    fetchData();
  };

  const applyFilters = useCallback(() => {
    let filtered = [...data];

    // Apply type filter
    if (selectedType) {
      filtered = filtered.filter(item => item.type === selectedType);
    }

    // Apply ID search
    if (searchId) {
      filtered = filtered.filter(item => 
        item.id.toLowerCase().includes(searchId.toLowerCase())
      );
    }

    setFilteredData(filtered);
    setPage(0);
  }, [data, selectedType, searchId]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleSearchChange = (event) => {
    setSearchId(event.target.value);
  };

  const clearSearch = () => {
    setSearchId('');
  };

  const handleRefresh = async () => {
    if (!isAuthenticated) return;
    try {
      setRefreshing(true);
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };
  
  const handleSubscribe = (row) => {
    if (!isAuthenticated) return;
    setSelectedObjectForSubscription(row);
    setSubscriptionDialogOpen(true);
  };

  const handleDeleteExternalObject = (object) => {
    const updatedObjects = externalObjects.filter(obj => obj.id !== object.id);
    setExternalObjects(updatedObjects);
    setRoleStorageItem('externalLogisticsObjects', JSON.stringify(updatedObjects));
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleExternalChangePage = (_, newPage) => {
    setExternalPage(newPage);
  };

  const paginatedData = filteredData.slice(
    page * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE + ROWS_PER_PAGE
  );

  const paginatedExternalData = externalObjects.slice(
    externalPage * ROWS_PER_PAGE,
    externalPage * ROWS_PER_PAGE + ROWS_PER_PAGE
  );

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(externalObjects.length / ROWS_PER_PAGE) - 1);
    if (externalPage > maxPage) {
      setExternalPage(maxPage);
    }
  }, [externalObjects, externalPage]);

  return (
    <Box>
      {/* Internal Objects Section */}
      <Paper sx={{ p: 3, mb: 4 }}>
        {/* Header and Controls */}
        <Box sx={{ mb: 3 }}>
          <Typography {...TABLE_STYLES.header}>
            <LocalShippingIcon />
            Internal Logistics Objects
          </Typography>
          
          {/* Filters and Controls */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Type</InputLabel>
                <Select
                  value={selectedType}
                  onChange={handleTypeChange}
                  label="Filter by Type"
                  endAdornment={
                    selectedType && (
                      <InputAdornment position="end">
                        <IconButton onClick={clearFilter} size="small">
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                >
                  <MenuItem value="">All Types</MenuItem>
                  {types.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Search by ID"
                value={searchId}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchId && (
                    <InputAdornment position="end">
                      <IconButton onClick={clearSearch} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={refreshing || !isAuthenticated}
                size="small"
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        {!isAuthenticated && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Authentication is unavailable. You are in guest mode and protected actions are disabled.
          </Alert>
        )}

        {/* Loading or Settings Invalid State */}
        {!settingsValid ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="textSecondary">
              Please configure API settings to view internal logistics objects
            </Typography>
          </Box>
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          /* Internal Data Table */
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Created At</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Updated At</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.type}
                        size="small"
                        sx={{
                          backgroundColor: 
                            row.type === 'Shipment' ? '#e3f2fd' :
                            row.type === 'Booking' ? '#f3e5f5' :
                            '#e8f5e9',
                          color: 
                            row.type === 'Shipment' ? '#1976d2' :
                            row.type === 'Booking' ? '#7b1fa2' :
                            '#2e7d32',
                        }}
                      />
                    </TableCell>
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                    <TableCell>{formatDate(row.updatedAt)}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!isAuthenticated}
                            onClick={() => handleView(row)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!isAuthenticated}
                            onClick={() => handleEdit(row, false)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Subscribe">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!isAuthenticated}
                            onClick={() => handleSubscribe(row)}
                          >
                            <MessageIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredData.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={ROWS_PER_PAGE}
              rowsPerPageOptions={[ROWS_PER_PAGE]}
            />
          </TableContainer>
        )}
      </Paper>

      {/* External Objects Section */}
      <Paper sx={{ p: 3, bgcolor: '#fafafa' }}>
        <Typography {...TABLE_STYLES.header} sx={{ color: '#424242' }}>
          <InventoryIcon />
          External Logistics Objects
        </Typography>
        
        {externalObjects.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">
              No external logistics objects found
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Server</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedExternalData.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.server}</TableCell>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.type}
                        size="small"
                        sx={{
                          backgroundColor: '#f5f5f5',
                          color: '#424242'
                        }}
                      />
                    </TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            disabled={!isAuthenticated}
                            onClick={() => {
                              navigate(`/logistics-objects/${row.id}`, {
                                state: { 
                                  isExternal: true,
                                  serverUrl: row.server
                                }
                              });
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!isAuthenticated}
                            onClick={() => handleEdit(row, true)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove from local database">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteExternalObject(row)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={externalObjects.length}
              page={externalPage}
              onPageChange={handleExternalChangePage}
              rowsPerPage={ROWS_PER_PAGE}
              rowsPerPageOptions={[ROWS_PER_PAGE]}
            />
          </TableContainer>
        )}
      </Paper>

      {/* Add LogisticsObjectEdit Dialog */}
      {selectedItem && editDialogOpen && (
        <LogisticsObjectEdit
          objectId={selectedItem.id}
          objectType={selectedItem.type}
          serverDetails={selectedItem.serverDetails}
          onClose={handleEditClose}
        />
      )}

      {subscriptionDialogOpen && selectedObjectForSubscription && (
        <SubscriptionDialog
          open={subscriptionDialogOpen}
          onClose={(success) => {
            setSubscriptionDialogOpen(false);
            setSelectedObjectForSubscription(null);
            if (success) {
              // Optionally show a success message or refresh data
            }
          }}
          objectId={`${getRoleStorageItem('baseUrl')}/logistics-objects/${selectedObjectForSubscription.id}`}
        />
      )}
    </Box>
  );
};

export default Database;
