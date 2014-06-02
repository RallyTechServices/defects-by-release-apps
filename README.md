defects-by-release-apps
=======================

This is a series of Rally Apps that take release into account directly, instead of
just by time box parameters.

## Defect Trend By Release

Similar to the existing Defect Trend chart except that it only deals with defects that
are associated with the Release itself.  

When a defect is associated with the chosen release (either directly when created OR
when assigned to the release some time after association), it is counted in this chart.

The black line represents the number of active defects on any given day in the release.
The red line represents the number of defects that were ever associated with the release.
The green line represents the total number of defects that have been closed.

## Defects by Field in Release

A stacked bar chart for every day of the release, showing breakdown by number of defects
associated with the release on that day, split by a chosen field.  This is a generic use
for making Priority and State charts.