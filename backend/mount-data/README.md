# mount-data

This directory is intentionally left empty in the repository.  
It is used as a mount point for a Persistent Volume Claim (PVC) in Kubernetes, so data placed here is **not versioned in Git**.
The PVC will persist this data even if the pod restarts or is rescheduled.

## Important!
This README is only here in git and consequently the locally pulled code base.  
**In the deployment it won't show up**, as only the data inside the pvc gets mounted to this directory, so all its contents here will **not be there**. 

## Local development
For local testing, you can manually place files into this folder using your file manager  
or copy them from the command line. These files are only used locally and will never be pushed to Git.

## Copying data into the cluster
To upload files into the PVC on your Kubernetes cluster, use `kubectl cp`.  
This copies files from your local machine into the pod that mounts the PVC.

Example command:

```
kubectl cp ./my-data/. <pod-name>:/usr/src/mount-data/
```

- ```./my-data/``` is the directory which contents you want to copy over, the dot (```.```) after tells it to not copy the directory itself, so no double names etc. an example would be "WebDeployTemplate"

- ```<pod-name>``` has to be extracted beforehand, and can be something like: "frings-pro78-webdeploy-14-stag-main14-backend-788b694854-gbbxk", and can be extracted from the pods yaml in k9s or other dashboards/ CL commands.

- The path to the actual mounting point can be relative (so ```/usr/src/``` is not strictly necessary) but just to be sure we give it the full path.
  the actual mounting point directory name should match the one given to the pod via its helm chart in the repo, which is this part here:

```yaml
app:
  pvc:
    enabled: true
    storage: 400M
    mountPath: "/usr/src/mount-data"
```


## Backing up data from the cluster

If the PVC already contains data, you may want to copy it back to your host before overwriting.
This allows you to keep a local backup of the current contents.
For this just change the order of the parameters in the copy command:

```
kubectl cp <pod-name>:/usr/src/mount-data ./backup-data/
```