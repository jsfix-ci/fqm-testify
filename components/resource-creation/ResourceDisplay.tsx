import { Stack } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import produce from 'immer';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import CodeEditorModal from '../modals/CodeEditorModal';
import { measureBundleState } from '../../state/atoms/measureBundle';
import { selectedDataRequirementState } from '../../state/atoms/selectedDataRequirement';
import { patientTestCaseState, TestCase } from '../../state/atoms/patientTestCase';
import { createFHIRResourceString, getFhirResourceSummary } from '../../util/fhir';
import { selectedPatientState } from '../../state/atoms/selectedPatient';
import { measurementPeriodState } from '../../state/atoms/measurementPeriod';
import ConfirmationModal from '../modals/ConfirmationModal';
import ResourceInfoCard from '../utils/ResourceInfoCard';
import { calculateMeasureReport } from '../../util/MeasureCalculation';
import { calculationLoading } from '../../state/atoms/calculationLoading';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons';
import { WritableDraft } from 'immer/dist/internal';

function ResourceDisplay() {
  const [currentTestCases, setCurrentTestCases] = useRecoilState(patientTestCaseState);
  const [currentResource, setCurrentResource] = useState<string | null>(null);
  const [selectedDataRequirement, setSelectedDataRequirement] = useRecoilState(selectedDataRequirementState);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const measureBundle = useRecoilValue(measureBundleState);
  const selectedPatient = useRecoilValue(selectedPatientState);
  const measurementPeriod = useRecoilValue(measurementPeriodState);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const setIsCalculationLoading = useSetRecoilState(calculationLoading);

  const openConfirmationModal = useCallback(
    (resourceId?: string) => {
      if (
        resourceId &&
        selectedPatient &&
        currentTestCases[selectedPatient].resources.findIndex(r => r.id === resourceId) >= 0
      ) {
        setCurrentResource(resourceId);
      } else {
        setCurrentResource(null);
      }
      setIsConfirmationModalOpen(true);
    },
    [currentTestCases, selectedPatient]
  );

  const closeConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setCurrentResource(null);
    setSelectedDataRequirement({ name: '', content: null });
  };

  const openResourceModal = useCallback(
    (resourceId?: string) => {
      if (
        resourceId &&
        selectedPatient &&
        currentTestCases[selectedPatient].resources.findIndex(r => r.id === resourceId) >= 0
      ) {
        setCurrentResource(resourceId);
      } else {
        setCurrentResource(null);
      }
      setIsResourceModalOpen(true);
    },
    [currentTestCases, selectedPatient]
  );

  useEffect(() => {
    if (selectedDataRequirement.content && !currentResource) {
      openResourceModal();
    }
  }, [openResourceModal, selectedDataRequirement, currentResource]);

  const closeResourceModal = () => {
    setIsResourceModalOpen(false);
    setCurrentResource(null);
    setSelectedDataRequirement({ name: '', content: null });
  };

  const measureReportCalculation = async (draftState: WritableDraft<TestCase>, selectedPatient: string) => {
    if (measureBundle.content) {
      try {
        draftState[selectedPatient].measureReport = await calculateMeasureReport(
          draftState[selectedPatient],
          measureBundle.content,
          measurementPeriod.start?.toISOString(),
          measurementPeriod.end?.toISOString()
        );
      } catch (error) {
        if (error instanceof Error) {
          showNotification({
            icon: <IconAlertCircle />,
            title: 'Calculation Error',
            message: error.message,
            color: 'red'
          });
        }
      }
    }
  };

  const updateResource = (val: string) => {
    setIsResourceModalOpen(false);
    closeResourceModal();
    setIsCalculationLoading(true);
    setTimeout(() => {
      const updatedResource = JSON.parse(val.trim());
      if (updatedResource.id) {
        const resourceId = updatedResource.id;

        // Create a new state object using immer without needing to shallow clone the entire previous object
        if (selectedPatient) {
          const resourceIndexToUpdate = currentTestCases[selectedPatient].resources.findIndex(r => r.id === resourceId);
          produce(currentTestCases, async draftState => {
            if (resourceIndexToUpdate < 0) {
              // add new resource
              draftState[selectedPatient].resources.push(updatedResource);
            } else {
              // update existing resource
              draftState[selectedPatient].resources[resourceIndexToUpdate] = updatedResource;
            }
            // re-run measure report calculations for updated state
            await measureReportCalculation(draftState, selectedPatient);
          }).then(nextResourceState => {
            setCurrentTestCases(nextResourceState);
            setIsCalculationLoading(false);
          });
        }
      }
    }, 400);
  };

  const deleteResource = (id: string | null) => {
    closeConfirmationModal();
    setIsCalculationLoading(true);
    setTimeout(() => {
      if (id && selectedPatient) {
        const resourceIndexToDelete = currentTestCases[selectedPatient].resources.findIndex(r => r.id === id);
        if (resourceIndexToDelete >= 0) {
          produce(currentTestCases, async draftState => {
            draftState[selectedPatient].resources.splice(resourceIndexToDelete, 1);
            // re-run measure report calculations for updated state
            await measureReportCalculation(draftState, selectedPatient);
          }).then(nextResourceState => {
            setCurrentTestCases(nextResourceState);
            setIsCalculationLoading(false);
          });
        }
      }
    }, 400);
  };

  const getInitialResource = () => {
    if (isResourceModalOpen) {
      if (currentResource && selectedPatient) {
        return JSON.stringify(
          currentTestCases[selectedPatient].resources.filter(r => r.id === currentResource)[0],
          null,
          2
        );
      } else {
        if (
          selectedDataRequirement.content &&
          measureBundle.content &&
          measurementPeriod.start &&
          measurementPeriod.end
        ) {
          return createFHIRResourceString(
            selectedDataRequirement.content,
            measureBundle.content,
            selectedPatient,
            measurementPeriod.start.toISOString(),
            measurementPeriod.end.toISOString()
          );
        }
      }
    }
    return undefined;
  };

  const getConfirmationModalText = (resourceId: string | null) => {
    if (selectedPatient && resourceId) {
      const resourceIndex = currentTestCases[selectedPatient].resources.findIndex(r => r.id === resourceId);
      const resource = currentTestCases[selectedPatient].resources[resourceIndex];
      return `Are you sure you want to delete ${resource.resourceType} ${getFhirResourceSummary(resource)}?`;
    }
  };

  return (
    <>
      <CodeEditorModal
        open={isResourceModalOpen}
        onClose={closeResourceModal}
        title="Edit FHIR Resource"
        onSave={updateResource}
        initialValue={getInitialResource()}
      />
      <ConfirmationModal
        open={isConfirmationModalOpen}
        onClose={closeConfirmationModal}
        title={getConfirmationModalText(currentResource)}
        onConfirm={() => deleteResource(currentResource)}
      />
      {selectedPatient && selectedDataRequirement && currentTestCases[selectedPatient].resources.length > 0 && (
        <Stack data-testid="resource-display-stack">
          {currentTestCases[selectedPatient].resources.map(resource => (
            <ResourceInfoCard
              key={resource.id}
              resourceType={resource.resourceType}
              label={getFhirResourceSummary(resource)}
              onEditClick={() => openResourceModal(resource.id)}
              onDeleteClick={() => openConfirmationModal(resource.id)}
            />
          ))}
        </Stack>
      )}
    </>
  );
}

export default ResourceDisplay;
