'use strict';

function normalizeMediaSurfaces(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((surface) => {
    if (typeof surface === 'string') {
      return {
        role: '',
        placement: '',
        source: surface.trim(),
        width: 0,
        height: 0,
        firstViewportArea: 0,
      };
    }

    if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
      return {
        role: '',
        placement: '',
        source: '',
        width: 0,
        height: 0,
        firstViewportArea: 0,
      };
    }

    return {
      role: typeof surface.role === 'string' ? surface.role.trim() : '',
      placement: typeof surface.placement === 'string' ? surface.placement.trim() : '',
      source: typeof surface.source === 'string' ? surface.source.trim() : '',
      width: finiteNumber(surface.width),
      height: finiteNumber(surface.height),
      firstViewportArea: finiteNumber(surface.firstViewportArea),
    };
  });
}

function mediaSurfaceRoleCounts(mediaSurfaces) {
  return normalizeMediaSurfaces(mediaSurfaces).reduce((counts, surface) => {
    if (surface.role) {
      counts[surface.role] = (counts[surface.role] || 0) + 1;
    }
    return counts;
  }, {});
}

function scaledMediaSurfaceRoleCounts(mediaSurfaces) {
  const surfaces = normalizeMediaSurfaces(mediaSurfaces).filter(hasMeasuredSurfaceSize);

  return {
    hero: surfaces.filter((surface) => surface.role === 'hero' && surface.placement === 'firstViewport' && isHeroScaleSurface(surface)).length,
    secondary: surfaces.filter((surface) => surface.role === 'secondary' && surface.placement === 'firstViewport' && isSecondaryScaleSurface(surface)).length,
    'service-card': surfaces.filter((surface) => surface.role === 'service-card' && surface.placement === 'afterHero' && isServiceCardScaleSurface(surface)).length,
  };
}

function roleScaleQualityErrors(mediaSurfaces, roleMinimums, label) {
  const roleCounts = mediaSurfaceRoleCounts(mediaSurfaces);
  const scaledCounts = scaledMediaSurfaceRoleCounts(mediaSurfaces);
  const supportedRoles = ['hero', 'secondary', 'service-card'];
  const errors = [];

  for (const role of supportedRoles) {
    const minimum = Number.isFinite(roleMinimums?.[role]) ? roleMinimums[role] : 0;
    if (minimum <= 0 || (roleCounts[role] || 0) < minimum) {
      continue;
    }
    if ((scaledCounts[role] || 0) < minimum) {
      errors.push(`${label}: rendered "${role}" media role is undersized (${scaledCounts[role] || 0}/${minimum} scaled surfaces).`);
    }
  }

  return errors;
}

function requiredRoleMinimums(requiredRoles, fallbackMinimums = {}) {
  if (!Array.isArray(requiredRoles)) {
    return { ...fallbackMinimums };
  }

  const minimums = requiredRoles.reduce((result, role) => {
    if (!role || typeof role !== 'object' || Array.isArray(role)) {
      return result;
    }
    const name = typeof role.role === 'string' ? role.role.trim() : '';
    const minSurfaces = Number.isFinite(role.minSurfaces) ? role.minSurfaces : 1;
    if (name) {
      result[name] = Math.max(result[name] || 0, minSurfaces);
    }
    return result;
  }, {});

  return Object.keys(minimums).length > 0 ? minimums : { ...fallbackMinimums };
}

function hasMeasuredSurfaceSize(surface) {
  return surface.width > 0 || surface.height > 0 || surface.firstViewportArea > 0;
}

function isHeroScaleSurface(surface) {
  return surface.height >= 320 || (surface.width >= 640 && surface.height >= 220) || surface.firstViewportArea >= 160000;
}

function isSecondaryScaleSurface(surface) {
  return surface.height >= 130 || (surface.width >= 220 && surface.height >= 100) || surface.firstViewportArea >= 24000;
}

function isServiceCardScaleSurface(surface) {
  return surface.height >= 140 || (surface.width >= 260 && surface.height >= 110) || surface.firstViewportArea >= 30000;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

module.exports = {
  hasMeasuredSurfaceSize,
  mediaSurfaceRoleCounts,
  normalizeMediaSurfaces,
  requiredRoleMinimums,
  roleScaleQualityErrors,
  scaledMediaSurfaceRoleCounts,
};
