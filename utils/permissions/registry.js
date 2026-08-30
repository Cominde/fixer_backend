module.exports = {
  workers: {
    label: "Workers Management",
    permissions: {
      'workers.view': { 
        label: 'View all workers (without salary)',
        endpoints: [
          { method: 'GET', path: '/api/V1/Worker' },
          { method: 'GET', path: '/api/V1/Worker/:id', params: ['id'] },
          { method: 'GET', path: '/api/V1/Worker/search/:searchString', params: ['searchString'] },
        ]
      },
      'workers.add': { 
        label: 'Add a new worker',
        endpoints: [
          { method: 'POST', path: '/api/V1/Worker' },
        ]
      },
      'workers.edit': { 
        label: 'Edit worker details',
        endpoints: [
          { method: 'PUT', path: '/api/V1/Worker/withoutNID/:id', params: ['id'] },
          { method: 'PUT', path: '/api/V1/Worker/:IdNumber', params: ['IdNumber'] },
        ]
      },
      'workers.delete': { 
        label: 'Delete a worker',
        endpoints: [
          { method: 'DELETE', path: '/api/V1/Worker/:id', params: ['id'] },
        ]
      },
      'workers.salary.view': { 
        label: 'View worker salaries',
        endpoints: [
          { method: 'GET', path: '/api/V1/Worker/salary' },
          { method: 'GET', path: '/api/V1/Worker/salary/:id', params: ['id'] },
        ]
      },
      'workers.money.add': { 
        label: 'Add loans/penalties/rewards to worker',
        endpoints: [
          { method: 'POST', path: '/api/V1/Worker/:id', params: ['id'] },
        ]
      },
    }
  },
  cars: {
    label: "Cars Management",
    permissions: {
      'cars.view': { 
        label: 'View all cars',
        endpoints: [
          { method: 'GET', path: '/api/V1/Garage' },
          { method: 'GET', path: '/api/V1/Garage/getCar/:id', params: ['id'] },
          { method: 'GET', path: '/api/V1/Garage/search/:searchString', params: ['searchString'] },
        ]
      },
      'cars.add': { 
        label: 'Add a new car',
        endpoints: [
          { method: 'POST', path: '/api/V1/Garage/add/:id', params: ['id'] },
        ]
      },
      'cars.edit': { 
        label: 'Edit car details',
        endpoints: [
          { method: 'PUT', path: '/api/V1/Garage/update/:id', params: ['id'] },
        ]
      },
      'cars.delete': { 
        label: 'Delete a car',
        endpoints: [
          { method: 'DELETE', path: '/api/V1/Garage/delete/:id', params: ['id'] },
        ]
      },
      'cars.image.upload': { 
        label: 'Upload car image',
        endpoints: [
          { method: 'POST', path: '/api/V1/Garage/cloudeniry/updateCarsImageInDB' },
        ]
      },
      'cars.image.generate': { 
        label: 'Generate car image',
        endpoints: [
          { method: 'PUT', path: '/api/V1/Garage/carImg/setCarImg' },
        ]
      },
    }
  },
  repairs: {
    label: "Repairs Management",
    permissions: {
      'repairs.view': { 
        label: 'View all repairs',
        endpoints: [
          { method: 'GET', path: '/api/V1/repairing' },
          { method: 'GET', path: '/api/V1/repairing/:carNumber', params: ['carNumber'] },
          { method: 'GET', path: '/api/V1/repairing/getById/:id', params: ['id'] },
          { method: 'GET', path: '/api/V1/repairing/gen/:generatedCode', params: ['generatedCode'] },
          { method: 'GET', path: '/api/V1/repairing/report/:id', params: ['id'] },
          { method: 'GET', path: '/api/V1/repairing/search/:searchTerm', params: ['searchTerm'] },
        ]
      },
      'repairs.add': { 
        label: 'Create a new repair',
        endpoints: [
          { method: 'POST', path: '/api/V1/repairing' },
          { method: 'POST', path: '/api/V1/repairing/walkIn' },
        ]
      },
      'repairs.edit': { 
        label: 'Edit repair details',
        endpoints: [
          { method: 'PUT', path: '/api/V1/repairing/update/:id', params: ['id'] },
        ]
      },
      'repairs.delete': { 
        label: 'Delete a repair',
        endpoints: [
          { method: 'DELETE', path: '/api/V1/repairing/delete/:id', params: ['id'] },
        ]
      },
      'repairs.technicians.manage': { 
        label: 'Manage technicians in repairs',
        endpoints: [ { method: 'PUT', path: '/api/V1/repairing/update/:id', params: ['id'] },]
      },
      'repairs.components.manage': { 
        label: 'Manage components in repairs',
        endpoints: [ { method: 'PUT', path: '/api/V1/repairing/update/:id', params: ['id'] },]
      },
      'repairs.services.manage': { 
        label: 'Manage services in repairs',
        endpoints: [
          { method: 'PUT', path: '/api/V1/repairing/:serviceId', params: ['serviceId'] },
        ]
      },
      'repairs.search': { 
        label: 'Search repairs',
        endpoints: [
          { method: 'GET', path: '/api/V1/repairing/search/:searchTerm', params: ['searchTerm'] },
        ]
      },
    }
  },
  measurements: {
    label: "Measurements Management",
    permissions: {
      'measurements.view': { 
        label: 'View all measurements',
        endpoints: [
          { method: 'GET', path: '/api/V1/measurement' },
          { method: 'GET', path: '/api/V1/measurement/:measurementNumber', params: ['measurementNumber'] },
        ]
      },
      'measurements.add': { 
        label: 'Create a new measurement',
        endpoints: [
          { method: 'POST', path: '/api/V1/measurement' },
        ]
      },
      'measurements.edit': { 
        label: 'Edit measurement details',
        endpoints: [
          { method: 'PUT', path: '/api/V1/measurement/:id', params: ['id'] },
        ]
      },
      'measurements.delete': { 
        label: 'Delete a measurement',
        endpoints: [
          { method: 'DELETE', path: '/api/V1/measurement/:id', params: ['id'] },
        ]
      },
      'measurements.accept': { 
        label: 'Accept measurement (convert to repair)',
        endpoints: [
          { method: 'PUT', path: '/api/V1/measurement/:id/accept', params: ['id'] },
        ]
      },
      'measurements.walkin': { 
        label: 'Create walk-in measurement',
        endpoints: [
          { method: 'POST', path: '/api/V1/measurement/walkIn' },
        ]
      },
    }
  },
  inventory: {
    label: "Inventory Management",
    permissions: {
      'inventory.view': { 
        label: 'View inventory',
        endpoints: [
          { method: 'GET', path: '/api/V1/Inventort' },
          { method: 'GET', path: '/api/V1/Inventort/:id', params: ['id'] },
          { method: 'GET', path: '/api/V1/Inventort/search/:searchString', params: ['searchString'] },
        ]
      },
      'inventory.add': { 
        label: 'Add inventory item',
        endpoints: [
          { method: 'POST', path: '/api/V1/Inventort' },
        ]
      },
      'inventory.edit': { 
        label: 'Edit inventory item',
        endpoints: [
          { method: 'PUT', path: '/api/V1/Inventort/:id', params: ['id'] },
        ]
      },
      'inventory.delete': { 
        label: 'Delete inventory item',
        endpoints: []
      },
    }
  },
  users: {
    label: "Users Management",
    permissions: {
      'users.view': { 
        label: 'View all users',
        endpoints: [
          { method: 'GET', path: '/api/V1/User' },
          { method: 'GET', path: '/api/V1/User/:id', params: ['id'] },
          { method: 'GET', path: '/api/V1/User/search/:searchString', params: ['searchString'] },
          { method: 'GET', path: '/api/V1/User/carCode/:clientType', params: ['clientType'] },
        ]
      },
      'users.edit': { 
        label: 'Edit user details',
        endpoints: [
          { method: 'PUT', path: '/api/V1/User/:id', params: ['id'] },
          { method: 'PUT', path: '/api/V1/User/changePassword/:id', params: ['id'] },
          { method: 'PUT', path: '/api/V1/User/active/:id', params: ['id'] },
          { method: 'POST', path: '/api/V1/User' },
        ]
      },
      'users.delete': { 
        label: 'Delete user',
        endpoints: [
          { method: 'DELETE', path: '/api/V1/User/:id', params: ['id'] },
        ]
      },
    }
  },
  permissions: {
    label: "Permission Management",
    permissions: {
      'permissions.roles.view': { 
        label: 'View roles',
        endpoints: [
          { method: 'GET', path: '/api/V1/permissions/roles' },
          { method: 'GET', path: '/api/V1/permissions/registry' },
        ]
      },
      'permissions.roles.create': { 
        label: 'Create roles',
        endpoints: [
          { method: 'POST', path: '/api/V1/permissions/roles' },
        ]
      },
      'permissions.roles.edit': { 
        label: 'Edit role permissions',
        endpoints: [
          { method: 'PUT', path: '/api/V1/permissions/roles/:id/permissions', params: ['id'] },
        ]
      },
      'permissions.workers.permissions.view': { 
        label: 'View worker permissions',
        endpoints: [
          { method: 'GET', path: '/api/V1/permissions/workers/:id/permissions', params: ['id'] },
        ]
      },
      'permissions.workers.permissions.edit': { 
        label: 'Edit worker permission overrides',
        endpoints: [
          { method: 'PUT', path: '/api/V1/permissions/workers/:id/permissions', params: ['id'] },
        ]
      },
    }
  },
  categoryCodes: {
    label: "Category Codes",
    permissions: {
      'categoryCodes.view': { 
        label: 'View category codes',
        endpoints: [
          { method: 'GET', path: '/api/V1/Category' },
          { method: 'GET', path: '/api/V1/Category/:id', params: ['id'] },
          { method: 'GET', path: '/api/V1/Category/search/:searchString', params: ['searchString'] },
          { method: 'GET', path: '/api/V1/Category/nextCode/:code', params: ['code'] },
        ]
      },
      'categoryCodes.add': { 
        label: 'Add category code',
        endpoints: [
          { method: 'POST', path: '/api/V1/Category' },
        ]
      },
      'categoryCodes.edit': { 
        label: 'Edit category code',
        endpoints: [
          { method: 'PUT', path: '/api/V1/Category/:id', params: ['id'] },
          { method: 'PUT', path: '/api/V1/Category/moveCode' },
        ]
      },
      'categoryCodes.delete': { 
        label: 'Delete category code',
        endpoints: [
          { method: 'DELETE', path: '/api/V1/Category/:id', params: ['id'] },
        ]
      },
    }
  }
};
