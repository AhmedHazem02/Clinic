import { PatientRegistrationForm } from "./patient-registration-form";
import { QueueList } from "./queue-list";

const initialPatients = [
    { queueNumber: 1, name: 'Alice Johnson', phone: '555-0101', status: 'Consulting' },
    { queueNumber: 2, name: 'Bob Williams', phone: '555-0102', status: 'Waiting' },
    { queueNumber: 3, name: 'Charlie Brown', phone: '555-0103', status: 'Waiting' },
    { queueNumber: 4, name: 'Diana Miller', phone: '555-0104', status: 'Waiting' },
];

export function NurseDashboardClient() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1">
                <PatientRegistrationForm />
            </div>
            <div className="lg:col-span-2">
                <QueueList initialPatients={initialPatients} />
            </div>
        </div>
    );
}
